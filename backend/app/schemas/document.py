from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    file_hash: str
    status: str
    chunk_count: int
    upload_time: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class DocumentUploadResult(BaseModel):
    id: str
    filename: str
    status: str
    file_type: str
    chunk_count: int
    error_message: Optional[str] = None
