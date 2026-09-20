from abc import ABC, abstractmethod
from typing import List, Dict, Any
from pydantic import BaseModel, Field

class DocumentContent(BaseModel):
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class BaseDocumentLoader(ABC):
    @abstractmethod
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        """
        Extracts content from a document file and returns a list of DocumentContent items.
        Each item represents a page, sheet, section, or block with associated metadata.
        """
        pass
