import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import User, Document
from backend.app.schemas.document import DocumentResponse, DocumentUploadResult
from backend.app.api.auth import get_current_user
from backend.app.utils.file_validation import validate_uploaded_file, sanitize_filename
from backend.app.utils.hashing import calculate_file_hash
from backend.app.services.document_service import document_service
from backend.app.core.config import settings
from backend.app.core.logging import logger

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.post("/upload", response_model=List[DocumentUploadResult])
async def upload_documents(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(settings.UPLOAD_DIRECTORY, exist_ok=True)
    results: List[DocumentUploadResult] = []

    for file in files:
        original_name = file.filename or "unknown"
        safe_name = sanitize_filename(original_name)
        file_bytes = await file.read()

        # 1. Validate file
        is_valid, file_type, val_err = validate_uploaded_file(safe_name, file_bytes)
        if not is_valid:
            results.append(
                DocumentUploadResult(
                    id=str(uuid.uuid4()),
                    filename=original_name,
                    status="FAILED",
                    file_type="UNKNOWN",
                    chunk_count=0,
                    error_message=val_err,
                )
            )
            continue

        file_hash = calculate_file_hash(file_bytes)

        # 2. Check for duplicate file for this user
        existing_doc = (
            db.query(Document)
            .filter(
                Document.user_id == current_user.id,
                Document.file_hash == file_hash,
                Document.status == "COMPLETED"
            )
            .first()
        )

        if existing_doc:
            logger.info(f"Duplicate document detected: '{original_name}' (Hash: {file_hash[:10]}...)")
            results.append(
                DocumentUploadResult(
                    id=existing_doc.id,
                    filename=original_name,
                    status="COMPLETED",
                    file_type=existing_doc.file_type,
                    chunk_count=existing_doc.chunk_count,
                    error_message="Duplicate file detected. Existing indexed document reused.",
                )
            )
            continue

        # 3. Store unique file on disk
        unique_filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}_{safe_name}"
        file_path = os.path.join(settings.UPLOAD_DIRECTORY, unique_filename)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # 4. Create document row in SQLite
        doc_record = Document(
            user_id=current_user.id,
            filename=unique_filename,
            original_filename=original_name,
            file_type=file_type,
            file_size=len(file_bytes),
            file_hash=file_hash,
            status="UPLOADED",
            chunk_count=0,
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)

        # 5. Process through the RAG pipeline
        try:
            processed_doc = document_service.process_document(
                db=db,
                document_id=doc_record.id,
                user_id=current_user.id,
                file_path=file_path,
                filename=original_name,
                file_type=file_type,
            )
            results.append(
                DocumentUploadResult(
                    id=processed_doc.id,
                    filename=original_name,
                    status=processed_doc.status,
                    file_type=processed_doc.file_type,
                    chunk_count=processed_doc.chunk_count,
                    error_message=None,
                )
            )
        except Exception as proc_err:
            results.append(
                DocumentUploadResult(
                    id=doc_record.id,
                    filename=original_name,
                    status="FAILED",
                    file_type=file_type,
                    chunk_count=0,
                    error_message=str(proc_err),
                )
            )

    return results

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.upload_time.desc())
        .all()
    )
    return docs

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )
    return doc

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = document_service.delete_document(db, document_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or unauthorized to delete."
        )
    return {"message": "Document and associated vector embeddings successfully deleted."}
