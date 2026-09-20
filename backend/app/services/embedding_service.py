from typing import List, Optional
import google.genai as genai
from google.genai import types
from backend.app.core.config import settings
from backend.app.core.logging import logger

class EmbeddingService:
    _instance: Optional["EmbeddingService"] = None

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.EMBEDDING_MODEL
        self._client: Optional[genai.Client] = None

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = EmbeddingService()
        return cls._instance

    def _get_client(self) -> genai.Client:
        if not self.api_key:
            # Re-read in case env was updated
            self.api_key = settings.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable is not configured. "
                "Please configure GEMINI_API_KEY in the environment or Settings panel."
            )
        if self._client is None:
            self._client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(
                    headers={"User-Agent": "aistudio-build"}
                )
            )
        return self._client

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embeds a list of document chunks in batches.
        """
        if not texts:
            return []

        client = self._get_client()
        batch_size = settings.EMBEDDING_BATCH_SIZE
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                # Call Gemini embedding API
                response = client.models.embed_content(
                    model=self.model_name,
                    contents=batch,
                )
                if hasattr(response, "embeddings") and response.embeddings:
                    for emb in response.embeddings:
                        all_embeddings.append(list(emb.values))
                elif hasattr(response, "embedding") and response.embedding:
                    all_embeddings.append(list(response.embedding.values))
                else:
                    raise ValueError("No embeddings returned by Gemini embedding model.")
            except Exception as e:
                logger.error(f"Gemini embedding batch failed ({i} to {i+len(batch)}): {str(e)}")
                raise ValueError(f"Gemini embedding generation failed: {str(e)}")

        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        """
        Embeds a single search query text.
        """
        if not text.strip():
            raise ValueError("Query text cannot be empty.")

        client = self._get_client()
        try:
            response = client.models.embed_content(
                model=self.model_name,
                contents=text,
            )
            if hasattr(response, "embeddings") and response.embeddings:
                return list(response.embeddings[0].values)
            elif hasattr(response, "embedding") and response.embedding:
                return list(response.embedding.values)
            else:
                raise ValueError("No embedding returned for query.")
        except Exception as e:
            logger.error(f"Gemini query embedding failed: {str(e)}")
            raise ValueError(f"Gemini query embedding failed: {str(e)}")

embedding_service = EmbeddingService.get_instance()
