import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from prisma import Json

from app.db.prisma_client import Prisma

logger = logging.getLogger(__name__)

PROCESSING_STATUS_UPLOADED = "uploaded"
PROCESSING_STATUS_PROCESSING = "processing"
PROCESSING_STATUS_ANALYZED = "analyzed"
PROCESSING_STATUS_FAILED = "failed"

ALLOWED_PROCESSING_STATUSES = {
    PROCESSING_STATUS_UPLOADED,
    PROCESSING_STATUS_PROCESSING,
    PROCESSING_STATUS_ANALYZED,
    PROCESSING_STATUS_FAILED,
}

# Limit expensive AI requests globally.
AI_CONCURRENCY_LIMITER = asyncio.Semaphore(3)

_RUNTIME_STATUS: Dict[str, Dict[str, Any]] = {}
_RUNTIME_LOCK = asyncio.Lock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


def _safe_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_status(value: str) -> str:
    normalized = _safe_text(value) or PROCESSING_STATUS_UPLOADED
    normalized = normalized.lower()
    if normalized not in ALLOWED_PROCESSING_STATUSES:
        return PROCESSING_STATUS_UPLOADED
    return normalized


async def set_runtime_status(
    *,
    resume_id: str,
    status: str,
    stage: Optional[str] = None,
    error_message: Optional[str] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
) -> None:
    snapshot = {
        "resume_id": resume_id,
        "status": normalize_status(status),
        "stage": _safe_text(stage),
        "error_message": _safe_text(error_message),
        "processing_started_at": _iso(started_at),
        "processing_completed_at": _iso(completed_at),
        "updated_at": _iso(_utc_now()),
    }
    async with _RUNTIME_LOCK:
        previous = _RUNTIME_STATUS.get(resume_id, {})
        _RUNTIME_STATUS[resume_id] = {
            **previous,
            **{k: v for k, v in snapshot.items() if v is not None},
        }


async def get_runtime_status(resume_id: str) -> Optional[Dict[str, Any]]:
    async with _RUNTIME_LOCK:
        value = _RUNTIME_STATUS.get(resume_id)
        return dict(value) if value else None


def extract_status_from_resume(resume: Any) -> Dict[str, Any]:
    parsed_data = getattr(resume, "parsed_data", None)
    parsed = parsed_data if isinstance(parsed_data, dict) else {}

    status = (
        _safe_text(getattr(resume, "processing_status", None))
        or _safe_text(parsed.get("processing_status"))
        or PROCESSING_STATUS_UPLOADED
    )
    stage = _safe_text(parsed.get("pipeline_stage") or parsed.get("processing_stage"))

    return {
        "resume_id": getattr(resume, "id", ""),
        "status": normalize_status(status),
        "stage": stage,
        "error_message": _safe_text(getattr(resume, "error_message", None) or parsed.get("error_message")),
        "processing_started_at": _iso(getattr(resume, "processing_started_at", None)) or _safe_text(parsed.get("processing_started_at")),
        "processing_completed_at": _iso(getattr(resume, "processing_completed_at", None)) or _safe_text(parsed.get("processing_completed_at")),
    }


async def get_resume_status_snapshot(db: Prisma, resume_id: str) -> Optional[Dict[str, Any]]:
    resume = await db.resume.find_unique(where={"id": resume_id})
    if not resume:
        return None

    persisted = extract_status_from_resume(resume)
    runtime = await get_runtime_status(resume_id)
    if runtime:
        persisted.update({k: v for k, v in runtime.items() if v is not None})
    return persisted


async def persist_processing_status(
    *,
    db: Prisma,
    resume_id: str,
    status: str,
    stage: Optional[str] = None,
    error_message: Optional[str] = None,
    mark_started: bool = False,
    mark_completed: bool = False,
) -> Dict[str, Any]:
    normalized_status = normalize_status(status)
    now = _utc_now()

    resume = await db.resume.find_unique(where={"id": resume_id})
    if not resume:
        raise ValueError(f"Resume not found: {resume_id}")

    parsed_data = getattr(resume, "parsed_data", None)
    parsed = dict(parsed_data) if isinstance(parsed_data, dict) else {}
    parsed["processing_status"] = normalized_status
    if stage:
        parsed["pipeline_stage"] = stage
    if error_message:
        parsed["error_message"] = error_message
    if mark_started:
        parsed["processing_started_at"] = _iso(now)
    if mark_completed:
        parsed["processing_completed_at"] = _iso(now)

    minimal_update: Dict[str, Any] = {
        "parsed_data": Json(parsed),
    }

    rich_update: Dict[str, Any] = {
        **minimal_update,
        "processing_status": normalized_status,
    }
    if error_message is not None:
        rich_update["error_message"] = error_message
    if mark_started:
        rich_update["processing_started_at"] = now
    if mark_completed:
        rich_update["processing_completed_at"] = now

    try:
        await db.resume.update(where={"id": resume_id}, data=rich_update)
    except Exception as exc:
        logger.debug("Falling back to parsed_data-only status update for resume %s: %s", resume_id, exc)
        await db.resume.update(where={"id": resume_id}, data=minimal_update)

    await set_runtime_status(
        resume_id=resume_id,
        status=normalized_status,
        stage=stage,
        error_message=error_message,
        started_at=now if mark_started else None,
        completed_at=now if mark_completed else None,
    )

    snapshot = await get_resume_status_snapshot(db, resume_id)
    if not snapshot:
        return {
            "resume_id": resume_id,
            "status": normalized_status,
            "stage": stage,
            "error_message": error_message,
            "processing_started_at": _iso(now) if mark_started else None,
            "processing_completed_at": _iso(now) if mark_completed else None,
        }
    return snapshot
