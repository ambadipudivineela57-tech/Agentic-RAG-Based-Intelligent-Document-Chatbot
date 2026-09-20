from typing import List, Dict, Any, Optional
import google.genai as genai
from google.genai import types
from backend.app.core.config import settings
from backend.app.core.logging import logger

class GeminiService:
    _instance: Optional["GeminiService"] = None

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self._client: Optional[genai.Client] = None

    @classmethod
    def get_instance(cls) -> "GeminiService":
        if cls._instance is None:
            cls._instance = GeminiService()
        return cls._instance

    def _get_client(self) -> genai.Client:
        if not self.api_key:
            self.api_key = settings.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured. Please configure GEMINI_API_KEY."
            )
        if self._client is None:
            self._client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(
                    headers={"User-Agent": "aistudio-build"}
                )
            )
        return self._client

    def generate_grounded_answer(
        self,
        question: str,
        context_chunks: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Generates a factual, grounded response based strictly on the retrieved context chunks.
        """
        if not context_chunks:
            return "I couldn't find enough information about this in the uploaded documents."

        client = self._get_client()

        # Build context string with explicit source tagging
        formatted_context_blocks = []
        for idx, chunk in enumerate(context_chunks, 1):
            meta = chunk.get("metadata", {})
            doc_name = meta.get("filename") or meta.get("source") or "Document"
            page_info = f", Page {meta.get('page')}" if meta.get("page") else ""
            sheet_info = f", Sheet '{meta.get('sheet')}'" if meta.get("sheet") else ""
            sec_info = f", Section '{meta.get('section')}'" if meta.get("section") else ""
            row_info = f", Rows {meta.get('row_range')}" if meta.get("row_range") else ""
            chunk_tag = f"[{idx}] Source: {doc_name}{page_info}{sheet_info}{sec_info}{row_info}"

            formatted_context_blocks.append(f"{chunk_tag}\n{chunk.get('text', '').strip()}")

        combined_context = "\n\n---\n\n".join(formatted_context_blocks)

        history_str = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-5:]:  # Keep last 5 messages for context
                role = "User" if msg.get("role") == "user" else "Assistant"
                history_lines.append(f"{role}: {msg.get('content')}")
            history_str = "\nRecent Conversation History:\n" + "\n".join(history_lines) + "\n"

        system_instruction = (
            "You are a document-grounded AI assistant.\n"
            "Use only the supplied retrieved context for factual claims about the user's documents.\n"
            "Do not invent information.\n"
            "If the answer is not supported by the retrieved context, clearly state that the uploaded documents do not contain enough information.\n"
            "Do not claim to have read content that was not retrieved.\n"
            "Use source metadata to identify supporting documents and cite sources naturally (e.g. [research.pdf, Page 3] or [employees.xlsx, Sheet 'Employees']).\n"
            "For numerical or tabular information, accurately report the figures present in the context."
        )

        user_prompt = (
            f"{history_str}\n"
            f"Retrieved Document Context:\n{combined_context}\n\n"
            f"User Question:\n{question}\n\n"
            f"Please provide a clear, accurate, grounded answer based strictly on the context above."
        )

        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,  # Low temperature for strict factual grounding
                )
            )
            return response.text or "I couldn't find enough information about this in the uploaded documents."
        except Exception as e:
            logger.error(f"Gemini generation error: {str(e)}")
            raise ValueError(f"Gemini generation failed: {str(e)}")

    def rewrite_query(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        reason: Optional[str] = None
    ) -> str:
        """
        Rewrites a vague or poorly retrieved query into a descriptive, search-optimized query.
        """
        client = self._get_client()

        history_str = ""
        if conversation_history:
            history_lines = [f"{m.get('role')}: {m.get('content')}" for m in conversation_history[-3:]]
            history_str = "Recent Conversation:\n" + "\n".join(history_lines) + "\n"

        prompt = (
            f"{history_str}"
            f"Original User Question: '{question}'\n"
            f"Reason for rewrite: {reason or 'Initial vector search retrieved low-relevance results.'}\n\n"
            "Task: Rewrite this question into an effective, unambiguous search query suitable for semantic vector retrieval over documents.\n"
            "Rules:\n"
            "1. Preserve the user's exact original intent.\n"
            "2. Resolve any relative pronouns (e.g., 'it', 'that algorithm', 'he', 'they') using conversation history if available.\n"
            "3. Return ONLY the rewritten query text, with no conversational preamble or quotes."
        )

        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.1)
            )
            rewritten = (response.text or "").strip().strip('"').strip("'")
            return rewritten if rewritten else question
        except Exception as e:
            logger.warning(f"Query rewrite fallback due to error: {str(e)}")
            return question

    def evaluate_relevance(
        self,
        question: str,
        chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Evaluates whether the retrieved chunks contain relevant information to answer the question.
        Returns: {"is_relevant": bool, "score": float, "reason": str}
        """
        if not chunks:
            return {"is_relevant": False, "score": 0.0, "reason": "No chunks retrieved."}

        # Check vector similarity scores first
        best_similarity = max((c.get("similarity_score", 0.0) for c in chunks), default=0.0)
        avg_similarity = sum(c.get("similarity_score", 0.0) for c in chunks) / len(chunks)

        # Keyword matching heuristic check
        keywords = [w.lower() for w in question.split() if len(w) > 3]
        all_text = " ".join(c.get("text", "").lower() for c in chunks)
        matched_keywords = [kw for kw in keywords if kw in all_text]
        keyword_match_ratio = len(matched_keywords) / max(1, len(keywords))

        # Combined relevance score
        combined_score = (best_similarity * 0.5) + (keyword_match_ratio * 0.5)

        is_relevant = combined_score >= settings.RELEVANCE_THRESHOLD or best_similarity >= 0.75

        return {
            "is_relevant": is_relevant,
            "score": round(combined_score, 3),
            "best_similarity": best_similarity,
            "reason": "Sufficient relevance" if is_relevant else "Low similarity and keyword overlap"
        }

gemini_service = GeminiService.get_instance()
