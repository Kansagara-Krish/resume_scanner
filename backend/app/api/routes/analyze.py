from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_session
from app.models.database import Chat, ChatMessage, Candidate, Resume, CandidateScore
from app.schemas.api import ChatRequest
from app.services.nlp_service import NLPService
import uuid

router = APIRouter()
nlp_service = NLPService()

@router.post("/")
async def analyze_jd(
    request: ChatRequest,
    db: Session = Depends(get_session),
    # In production, we'd have a current_user dependency here
    user_id: str = "default_user_id" 
):
    """
    Ranks candidates against a job description provided in the chat.
    """
    # 1. Get or Create Chat Session
    if request.chat_id:
        chat = db.query(Chat).filter(Chat.id == request.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        chat = Chat(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=request.message[:30] + "...",
            job_description=request.message
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    # 2. Store User Message
    user_msg = ChatMessage(
        id=str(uuid.uuid4()),
        chat_id=chat.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()

    # 3. Get All Candidates (simplified, usually filtered by user/folders)
    candidates = db.query(Candidate).all()
    if not candidates:
        return {
            "chat_id": chat.id,
            "message": "I haven't found any candidates in your database. Please upload some resumes first!",
            "candidates": []
        }

    # 4. Rank Candidates
    job_description = request.message
    results = []
    
    for candidate in candidates:
        # Get latest resume for candidate
        resume = db.query(Resume).filter(Resume.candidate_id == candidate.id).order_by(Resume.created_at.desc()).first()
        if not resume: continue
        
        analysis = nlp_service.analyze_candidate(
            resume.content_text, 
            job_description,
            model_type=request.model_type
        )
        
        # Save score to DB
        score_record = CandidateScore(
            chat_id=chat.id,
            candidate_id=candidate.id,
            model_type=request.model_type,
            score=analysis["score"],
            breakdown=analysis["breakdown"]
        )
        db.add(score_record)
        
        results.append({
            "id": candidate.id,
            "full_name": candidate.full_name,
            "score": analysis["score"],
            "breakdown": analysis["breakdown"],
            "skills": analysis["skills"],
            "matching_skills": analysis["matching_skills"],
            "missing_skills": analysis["missing_skills"]
        })

    # 5. Sort Results
    results = sorted(results, key=lambda x: x["score"], reverse=True)[:5] # Top 5
    
    # 6. Store Assistant Response
    top_names = [r["full_name"] for r in results]
    assistant_msg = ChatMessage(
        id=str(uuid.uuid4()),
        chat_id=chat.id,
        role="assistant",
        content=f"I've analyzed {len(candidates)} candidates. Here are the top matches: {', '.join(top_names)}."
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "chat_id": chat.id,
        "message": assistant_msg.content,
        "candidates": results
    }
