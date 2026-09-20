from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict

class RAGState(TypedDict):
    question: str
    rewritten_question: Optional[str]
    retrieved_documents: List[Dict[str, Any]]
    relevant_documents: List[Dict[str, Any]]
    answer: str
    sources: List[Dict[str, Any]]
    retry_count: int
    needs_rewrite: bool
    document_ids: List[str]
    user_id: str
    conversation_history: List[Dict[str, str]]
    relevance_score: float
