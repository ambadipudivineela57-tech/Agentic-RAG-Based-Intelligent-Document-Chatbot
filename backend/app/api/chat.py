from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import User, Document
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.api.auth import get_current_user
from backend.app.services.rag_service import rag_service
from backend.app.core.logging import logger

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
def chat_with_documents(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty."
        )

    # If document_ids are provided, ensure they belong to the authenticated user
    valid_doc_ids = []
    if payload.document_ids:
        user_docs = (
            db.query(Document.id)
            .filter(
                Document.id.in_(payload.document_ids),
                Document.user_id == current_user.id,
                Document.status == "COMPLETED"
            )
            .all()
        )
        valid_doc_ids = [d[0] for d in user_docs]
        if not valid_doc_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="None of the selected documents were found or ready for querying."
            )

    try:
        response = rag_service.process_chat(
            db=db,
            user_id=current_user.id,
            question=question,
            document_ids=valid_doc_ids if valid_doc_ids else None,
            conversation_id=payload.conversation_id,
        )
        return response
    except Exception as e:
        logger.error(f"Chat processing failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing error: {str(e)}"
        )
