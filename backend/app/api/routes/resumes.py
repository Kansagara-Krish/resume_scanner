from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.session import get_session
from app.models.database import Candidate, Resume
from app.services.google_drive import GoogleDriveService
from app.services.nlp_service import NLPService
import uuid

router = APIRouter()
drive_service = GoogleDriveService()
nlp_service = NLPService()

@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_session)
):
    """
    Handles PDF/DOC resume upload, extraction, and storage in GDrive & DB.
    """
    try:
        content = await file.read()
        filename = file.filename
        
        # 1. Extract Text
        extracted_text = nlp_service.extract_text_from_bytes(content, filename)
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Failed to extract text from resume")
            
        # 2. Upload to GDrive
        drive_id = drive_service.upload_file(content, filename, file.content_type)
        if not drive_id:
            drive_id = "placeholder_id"  # For local dev if no creds
            
        # 3. Create Candidate & Resume Record
        # (Simplified: Extract name from filename or text if possible)
        candidate_name = filename.replace('.pdf', '').replace('_', ' ').title()
        
        candidate = Candidate(
            id=str(uuid.uuid4()),
            full_name=candidate_name,
            skills=list(nlp_service.extract_skills(extracted_text))
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        
        resume_record = Resume(
            id=str(uuid.uuid4()),
            candidate_id=candidate.id,
            drive_file_id=drive_id,
            original_filename=filename,
            content_text=extracted_text
        )
        db.add(resume_record)
        db.commit()
        
        return {
            "id": candidate.id,
            "name": candidate.full_name,
            "filename": filename,
            "drive_id": drive_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading resume: {str(e)}")
