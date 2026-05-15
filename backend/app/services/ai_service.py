import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Union

import httpx
from prisma import Json

from app.core.config import settings
from app.db.session import db
from app.services.parsing_service import ParsingService
from app.services.queue_service import AI_CONCURRENCY_LIMITER, persist_processing_status
from app.services.scoring_service import ScoringService

logger = logging.getLogger(__name__)

OPENROUTER_MAX_RETRIES = 1
OPENROUTER_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}


def _extract_response_text(response_data: Dict[str, Any]) -> str:
    if not isinstance(response_data, dict):
        return ""

    choices = response_data.get("choices") or []
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            message = first.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str):
                    return content
            content = first.get("content")
            if isinstance(content, str):
                return content

    completion = response_data.get("completion")
    if isinstance(completion, str):
        return completion

    return ""


def _extract_json_from_text(text: str) -> Any:
    if not text:
        raise ValueError("AI response is empty")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    json_match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if not json_match:
        raise ValueError("AI response did not contain valid JSON")

    return json.loads(json_match.group(0))


async def generate_ai_response(
    prompt: str,
    max_tokens: int = 1024,
    temperature: float = 0.0,
    json_only: bool = True,
) -> Union[Dict[str, Any], List[Any], str]:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "top_p": 0.95,
        "max_tokens": max_tokens,
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    attempt = 0
    while True:
        attempt += 1
        start_time = time.perf_counter()
        try:
            logger.info(
                "AI request start: model=%s max_tokens=%s attempt=%s",
                settings.OPENROUTER_MODEL,
                max_tokens,
                attempt,
            )
            async with httpx.AsyncClient(timeout=settings.OPENROUTER_TIMEOUT) as client:
                response = await client.post(
                    settings.OPENROUTER_API_URL,
                    headers=headers,
                    json=payload,
                )

            duration = time.perf_counter() - start_time
            logger.info(
                "AI request success: status=%s duration=%.2fs model=%s",
                response.status_code,
                duration,
                settings.OPENROUTER_MODEL,
            )

            if response.status_code != 200:
                message = response.text.strip() or response.reason_phrase
                if response.status_code in OPENROUTER_RETRY_STATUS_CODES and attempt <= OPENROUTER_MAX_RETRIES:
                    logger.warning(
                        "Temporary OpenRouter error %s. Retrying attempt %s/%s.",
                        response.status_code,
                        attempt,
                        OPENROUTER_MAX_RETRIES + 1,
                    )
                    await asyncio.sleep(1.5 * attempt)
                    continue
                raise RuntimeError(
                    f"OpenRouter API error {response.status_code}: {message}"
                )

            data = response.json()
            content = _extract_response_text(data)
            if not content:
                raise ValueError("OpenRouter returned no assistant content")

            if not json_only:
                return content.strip()

            parsed = _extract_json_from_text(content)
            return parsed

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            duration = time.perf_counter() - start_time
            logger.error(
                "AI request failure: network error after %.2fs model=%s error=%s",
                duration,
                settings.OPENROUTER_MODEL,
                exc,
            )
            if attempt <= OPENROUTER_MAX_RETRIES:
                await asyncio.sleep(1.5 * attempt)
                continue
            raise RuntimeError("OpenRouter API request timed out or is unavailable")
        except json.JSONDecodeError as exc:
            logger.error("AI response JSON parse failed: %s", exc)
            raise RuntimeError("OpenRouter returned malformed JSON")


class AIService:
    def __init__(self) -> None:
        self.model_name = settings.OPENROUTER_MODEL
        self._parser = ParsingService()
        self._scorer = ScoringService()
        logger.info("Initialized AIService with OpenRouter model: %s", self.model_name)

    async def extract_candidate_profile(self, text: str, filename: str = "") -> Dict[str, Any]:
        clean_text = re.sub(r"\s+", " ", text or "").strip()
        prompt = (
            "Extract the candidate profile from the resume text and return ONLY valid JSON with the following keys: "
            "full_name, email, phone, location, linkedin_url, skills, soft_skills, degrees, experience_list, projects, certifications, awards, "
            "total_experience_years, projects_count, education, university, cgpa, sgpa, internships. "
            "Treat achievements, honors, recognitions, accolades, awards, notable contributions, and certifications as important resume sections. "
            "If the resume mentions a LinkedIn profile or URL, return the full LinkedIn link in linkedin_url. "
            "If a field cannot be determined, return null or an empty list. "
            "Resume Text: "
            f"{clean_text[:12000]}"
        )

        response = await generate_ai_response(prompt, max_tokens=1024, temperature=0.0, json_only=True)
        if not isinstance(response, dict):
            raise ValueError("Expected JSON object from resume parser")

        defaults = {
            "full_name": None,
            "email": None,
            "phone": None,
            "location": None,
            "skills": [],
            "soft_skills": [],
            "degrees": [],
            "experience_list": [],
            "projects": [],
            "certifications": [],
            "awards": [],
            "linkedin_url": None,
            "total_experience_years": 0.0,
            "projects_count": 0,
            "education": None,
            "university": None,
            "cgpa": None,
            "sgpa": None,
            "internships": [],
        }

        profile: Dict[str, Any] = {**defaults, **response}
        profile["normalized_skills"] = profile.get("skills") or []
        profile["total_experience"] = profile.get("total_experience_years") or 0.0
        profile["cgpa_or_percentage"] = profile.get("cgpa")

        return profile

    async def extract_skills(self, text: str) -> Set[str]:
        prompt = (
            "Extract all technical and soft skills mentioned in the text. "
            "Return ONLY a JSON array of strings. "
            f"Text: {text[:9000]}"
        )

        response = await generate_ai_response(prompt, max_tokens=512, temperature=0.0, json_only=True)
        skills = []
        if isinstance(response, list):
            skills = response
        elif isinstance(response, dict) and isinstance(response.get("skills"), list):
            skills = response["skills"]

        result: Set[str] = set()
        for item in skills:
            if isinstance(item, str) and item.strip():
                result.add(" ".join(item.strip().split()))
        return result

    async def analyze_candidate(
        self,
        resume_text: str,
        job_description: str,
        model_type: str = "ensemble",
    ) -> Dict[str, Any]:
        prompt = (
            "You are an advanced ATS Resume Matching Engine. Compare the resume against the job description using semantic understanding, NLP, and contextual relevance. "
            "Return ONLY valid JSON with the following keys: final_score, skills_score, experience_score, education_score, semantic_score, certifications_score, awards_projects_score, soft_skills_score, matched_keywords, missing_keywords, strengths, weaknesses, improvement_suggestions, skills, matching_skills, missing_skills, breakdown, academic_data, experience_data, soft_skills_data, additional_data. "
            "Do NOT rely on exact keyword matching only. Use semantic similarity, concept matching, transferable skills, and related terms. "
            "Recognize equivalent terms such as AI = Artificial Intelligence, MS Excel = Microsoft Excel, Teamwork = Collaboration, Leadership = Team Leadership. "
            "For certifications, awards, achievements, projects, and LinkedIn references, capture them where present. "
            "Use weighted scoring: skills 30%, experience 25%, semantic similarity 20%, education 10%, certifications 5%, awards/projects 5%, soft skills 5%. "
            "All top-level score fields must be numeric percentages from 0 to 100. Nested component scores may be 0 to 1 or 0 to 100. "
            "Also include a numeric score field named score identical to final_score for compatibility. "
            "Job Description: "
            f"{job_description}\n\n"
            "Resume: "
            f"{resume_text[:20000]}"
        )

        response = await generate_ai_response(prompt, max_tokens=1800, temperature=0.0, json_only=True)
        if not isinstance(response, dict):
            raise ValueError("Expected JSON object from candidate analysis")

        if "final_score" in response and "score" not in response:
            response["score"] = response["final_score"]
        if "score" not in response:
            response["score"] = 0.0

        if "skills" not in response:
            response["skills"] = list(await self.extract_skills(resume_text))
        if "matching_skills" not in response:
            response["matching_skills"] = []
        if "missing_skills" not in response:
            response["missing_skills"] = []
        if "matched_keywords" not in response:
            response["matched_keywords"] = []
        if "missing_keywords" not in response:
            response["missing_keywords"] = []
        if "strengths" not in response:
            response["strengths"] = []
        if "weaknesses" not in response:
            response["weaknesses"] = []
        if "improvement_suggestions" not in response:
            response["improvement_suggestions"] = []
        if "breakdown" not in response:
            response["breakdown"] = response.get("explanation") or ""

        return response

    async def get_professional_insights(
        self,
        combined_text: str,
        role_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        role_context = role_title or "General"
        prompt = (
            "Evaluate the professional profile and return ONLY valid JSON with four keys: communication, domain_fit, learning_ability, career_stability. "
            "Each value must be an object with score (0-100), explanation, reasons, evidence. "
            f"Role Context: {role_context}. Profile Text: {combined_text[:15000]}"
        )

        response = await generate_ai_response(prompt, max_tokens=1024, temperature=0.0, json_only=True)
        if not isinstance(response, dict):
            raise ValueError("Expected JSON object from professional insights")
        return response

    async def generate_chat_response(
        self,
        user_message: str,
        conversation_history: List[str],
        context_data: str = "",
    ) -> str:
        history_text = "\n".join(conversation_history[-10:]) if conversation_history else ""
        prompt = (
            "You are an AI HR assistant. Be concise, helpful, and professional. "
            f"Conversation History:\n{history_text}\n"
            f"Current Message: {user_message}\n"
            f"Context: {context_data}\n"
            "Reply with a clear response."
        )
        return str(await generate_ai_response(prompt, max_tokens=512, temperature=0.7, json_only=False)).strip()

    async def suggest_skills_for_role(
        self,
        role_title: str,
        role_description: str = "",
    ) -> List[str]:
        prompt = (
            "Based on the job role details, suggest 10 to 15 professional skills required for success. "
            "Return ONLY a JSON array of skill names as strings. "
            f"Role Title: {role_title}\n"
            f"Role Description: {role_description or 'Not provided'}"
        )

        response = await generate_ai_response(prompt, max_tokens=512, temperature=0.2, json_only=True)
        skills = []
        if isinstance(response, list):
            skills = response
        elif isinstance(response, dict) and isinstance(response.get("skills"), list):
            skills = response["skills"]

        normalized: List[str] = []
        seen: Set[str] = set()
        for item in skills:
            if isinstance(item, str) and item.strip():
                value = " ".join(item.strip().split())
                if value.lower() not in seen:
                    normalized.append(value)
                    seen.add(value.lower())
            if len(normalized) >= 15:
                break

        return normalized


class AIProcessingService:
    def __init__(self) -> None:
        self.ai_service = AIService()
        self.parsing_service = ParsingService()
        self.scoring_service = ScoringService()

    async def process_resume_ai(self, resume_id: str, filename: str, content: bytes) -> None:
        if not db.is_connected():
            await db.connect()

        try:
            await persist_processing_status(
                db=db,
                resume_id=resume_id,
                status="processing",
                stage="Parsing Resume",
                mark_started=True,
            )

            content_text = await self.parsing_service.extract_resume_text(content, filename)
            if not content_text:
                raise ValueError("No readable text found in resume. Please upload a valid PDF/DOCX/TXT file.")

            await persist_processing_status(
                db=db,
                resume_id=resume_id,
                status="processing",
                stage="Running AI Analysis",
            )

            async with AI_CONCURRENCY_LIMITER:
                parsed_profile = await self.ai_service.extract_candidate_profile(content_text, filename)

            insights = self.scoring_service.build_candidate_insights(parsed_profile)

            resume = await db.resume.find_unique(where={"id": resume_id})
            if not resume:
                raise ValueError(f"Resume not found: {resume_id}")

            current_parsed = getattr(resume, "parsed_data", None)
            merged_parsed: Dict[str, Any] = dict(current_parsed) if isinstance(current_parsed, dict) else {}
            merged_parsed.update(parsed_profile)
            merged_parsed["ai_insights"] = insights
            merged_parsed["processing_status"] = "analyzed"
            merged_parsed["pipeline_stage"] = "Completed"
            merged_parsed["error_message"] = None

            rich_update = {
                "content_text": content_text,
                "parsed_data": Json(merged_parsed),
                "processing_status": "analyzed",
                "error_message": None,
            }
            fallback_update = {
                "content_text": content_text,
                "parsed_data": Json(merged_parsed),
            }

            try:
                await db.resume.update(where={"id": resume_id}, data=rich_update)
            except Exception:
                await db.resume.update(where={"id": resume_id}, data=fallback_update)

            await persist_processing_status(
                db=db,
                resume_id=resume_id,
                status="analyzed",
                stage="Completed",
                mark_completed=True,
            )
        except Exception as exc:
            logger.exception("Failed AI processing for resume %s", resume_id)
            await persist_processing_status(
                db=db,
                resume_id=resume_id,
                status="failed",
                stage="Failed",
                error_message=str(exc),
                mark_completed=True,
            )


ai_processing_service = AIProcessingService()


async def process_resume_ai(resume_id: str, filename: str, content: bytes) -> None:
    await ai_processing_service.process_resume_ai(resume_id=resume_id, filename=filename, content=content)
