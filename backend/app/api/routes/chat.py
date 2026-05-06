from fastapi import APIRouter, Depends, HTTPException
from app.db.prisma_client import Prisma
from app.db.session import get_db
from app.api.dependencies import get_current_user
from app.schemas.api import ChatSimple, ChatHistoryResponse, ChatMessageBase, ChatRequest
from app.services.nlp_service import NLPService
from typing import List
import logging

logger = logging.getLogger(__name__)
router = APIRouter()
nlp_service = NLPService()

@router.post("/new", response_model=ChatSimple)
async def create_chat(
    title: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    chat = await db.chat.create(
        data={
            "user_id": current_user.id,
            "title": title
        }
    )
    return chat

@router.get("/history", response_model=ChatHistoryResponse)
async def get_history(
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    chats = await db.chat.find_many(
        where={"user_id": current_user.id},
        order={"created_at": "desc"}
    )
    return ChatHistoryResponse(chats=[ChatSimple.from_orm(c) for c in chats])

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Verify ownership
    chat = await db.chat.find_unique(where={"id": chat_id})
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Delete messages first
    await db.chatmessage.delete_many(where={"chat_id": chat_id})
    await db.chat.delete(where={"id": chat_id})
    return {"message": "Chat deleted"}

@router.get("/{chat_id}/messages", response_model=List[ChatMessageBase])
async def get_messages(
    chat_id: str,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    # Verify ownership
    chat = await db.chat.find_unique(where={"id": chat_id})
    if not chat or chat.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    return await db.chatmessage.find_many(
        where={"chat_id": chat_id},
        order={"created_at": "asc"}
    )

@router.post("/{chat_id}/messages", response_model=ChatMessageBase)
async def send_chat_message(
    chat_id: str,
    request: ChatRequest,
    current_user = Depends(get_current_user),
    db: Prisma = Depends(get_db)
):
    """Send a message in a chat and get an AI response using Ollama"""
    try:
        # Verify chat ownership
        chat = await db.chat.find_unique(where={"id": chat_id})
        if not chat or chat.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get chat history for context
        messages = await db.chatmessage.find_many(
            where={"chat_id": chat_id},
            order={"created_at": "asc"}
        )
        
        # Build conversation context
        conversation_history = [
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
            for m in messages[-10:]  # Last 10 messages for context
        ]
        
        # Save user message
        user_msg = await db.chatmessage.create(
            data={
                "chat_id": chat_id,
                "role": "user",
                "content": request.message
            }
        )
        
        # Generate response using Ollama
        try:
            response_text = await nlp_service.generate_chat_response(
                user_message=request.message,
                conversation_history=conversation_history,
                context_data=request.message  # Can include resume context if needed
            )
        except Exception as e:
            logger.error(f"Ollama generation error: {e}")
            response_text = "I encountered an error while generating a response. Please try again."
        
        # Save assistant response
        assistant_msg = await db.chatmessage.create(
            data={
                "chat_id": chat_id,
                "role": "assistant",
                "content": response_text
            }
        )
        
        return ChatMessageBase(
            role="assistant",
            content=response_text,
            created_at=assistant_msg.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat message error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")
