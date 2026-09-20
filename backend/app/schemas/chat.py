from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class SourceCitation(BaseModel):
    document: str
    document_id: Optional[str] = None
    page: Optional[int] = None
    sheet: Optional[str] = None
    section: Optional[str] = None
    row_range: Optional[str] = None
    chunk_id: Optional[Any] = None
    snippet: Optional[str] = None

class ChatMetadata(BaseModel):
    retry_count: int = 0
    retrieved_chunk_count: int = 0
    rewritten_query: Optional[str] = None
    relevance_score: Optional[float] = None

class ChatRequest(BaseModel):
    question: str
    document_ids: List[str] = []
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceCitation] = []
    metadata: ChatMetadata
    conversation_id: Optional[str] = None
