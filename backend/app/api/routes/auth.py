from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_session
from app.models.database import User
from app.schemas.api import UserBase
import uuid

router = APIRouter()

@router.post("/google/login")
async def google_login(
    user_data: UserBase,
    db: Session = Depends(get_session)
):
    """
    Simulates Google OAuth login for the AI HR Copilot.
    """
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=user_data.email,
            full_name=user_data.full_name,
            avatar_url=user_data.avatar_url
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return {
        "access_token": "ey-dummy-token-" + str(uuid.uuid4()),
        "token_type": "bearer",
        "user": user
    }
