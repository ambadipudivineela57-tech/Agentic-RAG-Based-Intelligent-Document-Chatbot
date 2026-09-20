import os
import re
from typing import Tuple, Optional
from backend.app.core.config import settings

ALLOWED_EXTENSIONS = {
    ".pdf": "PDF",
    ".doc": "DOC",
    ".docx": "DOCX",
    ".txt": "TXT",
    ".md": "MARKDOWN",
    ".markdown": "MARKDOWN",
    ".rtf": "RTF",
    ".csv": "CSV",
    ".xls": "EXCEL",
    ".xlsx": "EXCEL",
    ".json": "JSON",
    ".xml": "XML",
}

# Signatures (magic bytes) for common binary types
MAGIC_SIGNATURES = {
    "PDF": b"%PDF",
    "DOCX": b"PK\x03\x04",
    "EXCEL_XLSX": b"PK\x03\x04",
    "DOC": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
    "EXCEL_XLS": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
    "RTF": b"{\\rtf",
}

def sanitize_filename(filename: str) -> str:
    """
    Protects against path traversal attacks (e.g. ../../etc/passwd)
    and removes potentially harmful special characters.
    """
    filename = os.path.basename(filename)
    filename = re.sub(r"[^\w\.\-\_ ]", "", filename)
    filename = filename.strip()
    return filename or "document"

def validate_uploaded_file(filename: str, file_bytes: bytes) -> Tuple[bool, str, str]:
    """
    Validates the uploaded file extension, size, and header signature.
    Returns: (is_valid, file_type, error_message)
    """
    if not filename:
        return False, "", "Filename cannot be empty."

    safe_name = sanitize_filename(filename)
    _, ext = os.path.splitext(safe_name.lower())

    if ext not in ALLOWED_EXTENSIONS:
        supported = ", ".join(sorted(ALLOWED_EXTENSIONS.keys()))
        return False, "", f"Unsupported file extension '{ext}'. Supported formats are: {supported}."

    file_size_mb = len(file_bytes) / (1024 * 1024)
    if file_size_mb > settings.MAX_FILE_SIZE_MB:
        return False, "", f"File size ({file_size_mb:.2f} MB) exceeds maximum allowed limit of {settings.MAX_FILE_SIZE_MB} MB."

    if len(file_bytes) == 0:
        return False, "", "The uploaded file is empty (0 bytes)."

    file_type = ALLOWED_EXTENSIONS[ext]

    # Validate binary signatures where applicable
    if ext == ".pdf" and not file_bytes.startswith(MAGIC_SIGNATURES["PDF"]):
        return False, "", "Invalid PDF file: File signature does not match PDF specification."

    if ext == ".docx" and not file_bytes.startswith(MAGIC_SIGNATURES["DOCX"]):
        return False, "", "Invalid DOCX file: File signature does not match Office Open XML standard."

    if ext == ".xlsx" and not file_bytes.startswith(MAGIC_SIGNATURES["EXCEL_XLSX"]):
        return False, "", "Invalid XLSX file: File signature does not match Excel Open XML standard."

    if ext == ".rtf" and not file_bytes.startswith(MAGIC_SIGNATURES["RTF"]):
        return False, "", "Invalid RTF file: File signature does not match Rich Text Format specification."

    if ext in (".doc", ".xls"):
        # Legacy binary Microsoft Office files start with OLE compound file header
        if not file_bytes.startswith(MAGIC_SIGNATURES["DOC"]):
            return False, "", f"Invalid legacy {ext.upper()} file: File signature does not match OLE binary document format."

    return True, file_type, ""
