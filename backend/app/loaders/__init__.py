import os
from typing import Dict, Type
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.loaders.pdf_loader import PDFLoader
from backend.app.loaders.doc_loader import DOCLoader
from backend.app.loaders.docx_loader import DOCXLoader
from backend.app.loaders.txt_loader import TXTLoader
from backend.app.loaders.markdown_loader import MarkdownLoader
from backend.app.loaders.rtf_loader import RTFLoader
from backend.app.loaders.csv_loader import CSVLoader
from backend.app.loaders.excel_loader import ExcelLoader
from backend.app.loaders.json_loader import JSONLoader
from backend.app.loaders.xml_loader import XMLLoader

LOADER_REGISTRY: Dict[str, Type[BaseDocumentLoader]] = {
    ".pdf": PDFLoader,
    ".doc": DOCLoader,
    ".docx": DOCXLoader,
    ".txt": TXTLoader,
    ".md": MarkdownLoader,
    ".markdown": MarkdownLoader,
    ".rtf": RTFLoader,
    ".csv": CSVLoader,
    ".xls": ExcelLoader,
    ".xlsx": ExcelLoader,
    ".json": JSONLoader,
    ".xml": XMLLoader,
}

def get_loader_for_file(filename: str) -> BaseDocumentLoader:
    _, ext = os.path.splitext(filename.lower())
    loader_cls = LOADER_REGISTRY.get(ext)
    if not loader_cls:
        raise ValueError(f"No document loader registered for extension '{ext}'.")
    return loader_cls()

__all__ = [
    "BaseDocumentLoader",
    "DocumentContent",
    "PDFLoader",
    "DOCLoader",
    "DOCXLoader",
    "TXTLoader",
    "MarkdownLoader",
    "RTFLoader",
    "CSVLoader",
    "ExcelLoader",
    "JSONLoader",
    "XMLLoader",
    "get_loader_for_file",
]
