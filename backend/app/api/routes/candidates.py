from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_session
from app.models.database import Candidate
import uuid

router = APIRouter()

@router.get("/")
async def list_candidates(
    db: Session = Depends(get_session)
):
    """
    Returns list of all candidates.
    """
    return db.query(Candidate).all()

@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: str,
    db: Session = Depends(get_session)
):
    """
    Returns specific candidate details.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
