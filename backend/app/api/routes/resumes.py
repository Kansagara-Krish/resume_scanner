from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.db.prisma_client import Prisma
from app.schemas.api import ResumeResultResponse, ResumeSimple, ResumeStatusResponse, ResumeUploadResponse
from app.services.ai_service import process_resume_ai
from app.services.queue_service import get_resume_status_snapshot, persist_processing_status
from typing import List
from prisma import Json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """
    Handles resume upload and schedules background AI processing.
    """
    logger.info(f"Uploading resume: {file.filename}")
    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        resume = await db.resume.create(
            data={
                "file_name": file.filename or "uploaded_resume",
                "content_text": "",
                "parsed_data": Json({
                    "processing_status": "uploaded",
                    "pipeline_stage": "Uploaded",
                }),
                "uploaded_by": current_user.id,
            }
        )
        logger.info(f"Resume saved with ID: {resume.id}. Enqueuing background AI processing.")

        await persist_processing_status(
            db=db,
            resume_id=resume.id,
            status="uploaded",
            stage="Uploaded",
        )

        background_tasks.add_task(
            process_resume_ai,
            resume.id,
            file.filename or "uploaded_resume",
            content,
        )
        
        return ResumeUploadResponse(
            filename=resume.file_name,
            name=resume.file_name,
            id=resume.id,
            status="uploaded",
            drive_id="",
            candidate_id=resume.id,
            extracted_text="Processing in background",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_resume: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error uploading resume: {str(e)}")

@router.get("/", response_model=List[ResumeSimple])
async def get_resumes(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    return await db.resume.find_many(
        where={"uploaded_by": current_user.id}, 
        order={"created_at": "desc"}
    )


@router.get("/status/{resume_id}", response_model=ResumeStatusResponse)
async def get_resume_status(
    resume_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_unique(where={"id": resume_id})
    if not resume or getattr(resume, "uploaded_by", None) != current_user.id:
        raise HTTPException(status_code=404, detail="Resume not found")

    snapshot = await get_resume_status_snapshot(db, resume_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Resume not found")

    return ResumeStatusResponse(**snapshot)


@router.get("/result/{resume_id}", response_model=ResumeResultResponse)
async def get_resume_result(
    resume_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_unique(where={"id": resume_id})
    if not resume or getattr(resume, "uploaded_by", None) != current_user.id:
        raise HTTPException(status_code=404, detail="Resume not found")

    snapshot = await get_resume_status_snapshot(db, resume_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed_data = getattr(resume, "parsed_data", None)
    parsed = parsed_data if isinstance(parsed_data, dict) else {}
    ai_insights = parsed.get("ai_insights") if isinstance(parsed.get("ai_insights"), dict) else {}

    return ResumeResultResponse(
        resume_id=resume_id,
        status=snapshot.get("status", "uploaded"),
        stage=snapshot.get("stage"),
        candidate_score=ai_insights.get("candidate_score") if isinstance(ai_insights.get("candidate_score"), (int, float)) else None,
        parsed_data=parsed,
        error_message=snapshot.get("error_message"),
    )


@router.get("/{resume_id}")
async def get_resume_by_id(
    resume_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db),
):
    resume = await db.resume.find_unique(where={"id": resume_id})
    if not resume or getattr(resume, "uploaded_by", None) != current_user.id:
        raise HTTPException(status_code=404, detail="Resume not found")

    return resume
