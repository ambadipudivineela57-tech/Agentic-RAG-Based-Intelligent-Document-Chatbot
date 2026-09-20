import os
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.db.models import Document
from backend.app.loaders import get_loader_for_file
from backend.app.services.embedding_service import embedding_service
from backend.app.services.vector_service import vector_service

class DocumentService:
    _instance: Optional["DocumentService"] = None

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    @classmethod
    def get_instance(cls) -> "DocumentService":
        if cls._instance is None:
            cls._instance = DocumentService()
        return cls._instance

    def process_document(
        self,
        db: Session,
        document_id: str,
        user_id: str,
        file_path: str,
        filename: str,
        file_type: str,
    ) -> Document:
        """
        Executes the end-to-end document processing pipeline:
        File -> Loader -> Extraction -> Cleaning -> Chunking -> Metadata -> Embeddings -> ChromaDB
        """
        doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
        if not doc:
            raise ValueError(f"Document with id '{document_id}' not found.")

        try:
            # 1. Update status to PROCESSING
            doc.status = "PROCESSING"
            doc.error_message = None
            db.commit()
            db.refresh(doc)
            logger.info(f"Starting processing for document '{filename}' (ID: {document_id})")

            # 2. Extract content using registered loader
            loader = get_loader_for_file(filename)
            raw_contents = loader.load(file_path, filename)

            if not raw_contents:
                raise ValueError("No extractable content found in document.")

            # 3. Chunk contents and build rich metadata
            all_chunks: List[str] = []
            all_metadatas: List[Dict[str, Any]] = []
            all_ids: List[str] = []
            chunk_counter = 0

            for content_item in raw_contents:
                splits = self.text_splitter.split_text(content_item.text)
                for split_text in splits:
                    if not split_text.strip():
                        continue
                    chunk_counter += 1
                    chunk_uid = f"{document_id}_chunk_{chunk_counter}"
                    
                    meta: Dict[str, Any] = {
                        "user_id": user_id,
                        "document_id": document_id,
                        "filename": filename,
                        "file_type": file_type,
                        "chunk_id": chunk_counter,
                        "source": filename,
                    }
                    # Merge format-specific metadata (e.g. page, sheet, section, row_range)
                    for k, v in content_item.metadata.items():
                        if k not in meta:
                            meta[k] = v

                    all_chunks.append(split_text)
                    all_metadatas.append(meta)
                    all_ids.append(chunk_uid)

            if not all_chunks:
                raise ValueError("Document produced zero text chunks after splitting.")

            logger.info(f"Document '{filename}' split into {len(all_chunks)} chunks. Generating embeddings...")

            # 4. Generate Gemini embeddings
            embeddings = embedding_service.embed_documents(all_chunks)

            # 5. Insert into ChromaDB
            vector_service.add_chunks(
                ids=all_ids,
                embeddings=embeddings,
                documents=all_chunks,
                metadatas=all_metadatas,
            )

            # 6. Update database record to COMPLETED
            doc.status = "COMPLETED"
            doc.chunk_count = len(all_chunks)
            doc.error_message = None
            db.commit()
            db.refresh(doc)
            logger.info(f"Successfully completed processing for document '{filename}'. Chunks: {len(all_chunks)}")
            return doc

        except Exception as e:
            logger.error(f"Processing failed for document '{filename}': {str(e)}")
            doc.status = "FAILED"
            doc.error_message = str(e)
            db.commit()
            db.refresh(doc)
            raise

    def delete_document(self, db: Session, document_id: str, user_id: str) -> bool:
        """
        Deletes a document from SQLite, ChromaDB vectors, and the local filesystem.
        """
        doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
        if not doc:
            return False

        # 1. Delete ChromaDB vectors
        try:
            vector_service.delete_document_vectors(document_id, user_id)
        except Exception as ve:
            logger.warning(f"Vector deletion warning for document '{document_id}': {str(ve)}")

        # 2. Delete physical file if it exists
        if doc.filename:
            file_path = os.path.join(settings.UPLOAD_DIRECTORY, doc.filename)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as fe:
                    logger.warning(f"Could not remove physical file '{file_path}': {str(fe)}")

        # 3. Delete SQLite record
        db.delete(doc)
        db.commit()
        logger.info(f"Deleted document '{document_id}' belonging to user '{user_id}'.")
        return True

document_service = DocumentService.get_instance()
