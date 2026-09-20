import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
from backend.app.core.config import settings
from backend.app.core.logging import logger

class VectorService:
    _instance: Optional["VectorService"] = None

    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIRECTORY,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection_name = "document_chunks"
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "Agentic RAG document chunks collection"}
        )

    @classmethod
    def get_instance(cls) -> "VectorService":
        if cls._instance is None:
            cls._instance = VectorService()
        return cls._instance

    def add_chunks(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        """
        Stores chunks and their embeddings into ChromaDB with metadata.
        """
        if not ids:
            return

        # ChromaDB metadata values must be str, int, float, or bool
        cleaned_metadatas = []
        for meta in metadatas:
            clean_meta = {}
            for k, v in meta.items():
                if v is None:
                    continue
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                else:
                    clean_meta[k] = str(v)
            cleaned_metadatas.append(clean_meta)

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=cleaned_metadatas,
        )
        logger.info(f"Inserted {len(ids)} chunks into ChromaDB collection '{self.collection_name}'.")

    def search(
        self,
        query_embedding: List[float],
        user_id: str,
        document_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top-K chunks strictly isolated to the specified user_id.
        Optionally filters by specific document_ids.
        """
        k = top_k or settings.TOP_K

        # Enforce strict user isolation
        if document_ids and len(document_ids) > 0:
            if len(document_ids) == 1:
                where_filter = {
                    "$and": [
                        {"user_id": {"$eq": user_id}},
                        {"document_id": {"$eq": document_ids[0]}}
                    ]
                }
            else:
                where_filter = {
                    "$and": [
                        {"user_id": {"$eq": user_id}},
                        {"document_id": {"$in": document_ids}}
                    ]
                }
        else:
            where_filter = {"user_id": {"$eq": user_id}}

        # Check total count in collection
        if self.collection.count() == 0:
            return []

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(k, max(1, self.collection.count())),
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        retrieved: List[Dict[str, Any]] = []
        if not results or not results["ids"] or not results["ids"][0]:
            return retrieved

        ids = results["ids"][0]
        docs = results["documents"][0] if results.get("documents") else []
        metas = results["metadatas"][0] if results.get("metadatas") else []
        distances = results["distances"][0] if results.get("distances") else []

        for idx in range(len(ids)):
            # Convert cosine / L2 distance to similarity score
            # Chroma default L2 squared distance: similarity ~ 1 / (1 + distance)
            dist = distances[idx] if idx < len(distances) else 1.0
            similarity = 1.0 / (1.0 + float(dist))

            retrieved.append({
                "chunk_id": ids[idx],
                "text": docs[idx] if idx < len(docs) else "",
                "metadata": metas[idx] if idx < len(metas) else {},
                "distance": dist,
                "similarity_score": round(similarity, 4),
            })

        return retrieved

    def delete_document_vectors(self, document_id: str, user_id: str) -> None:
        """
        Deletes all vector chunks associated with a document_id, ensuring user ownership.
        """
        where_filter = {
            "$and": [
                {"user_id": {"$eq": user_id}},
                {"document_id": {"$eq": document_id}}
            ]
        }
        try:
            self.collection.delete(where=where_filter)
            logger.info(f"Deleted vectors for document '{document_id}' belonging to user '{user_id}'.")
        except Exception as e:
            logger.error(f"Error deleting vectors for document '{document_id}': {str(e)}")
            raise

vector_service = VectorService.get_instance()
