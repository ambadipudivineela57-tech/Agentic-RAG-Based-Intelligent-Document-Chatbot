from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class TXTLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        encodings_to_try = ["utf-8", "utf-8-sig", "utf-16", "latin-1", "cp1252"]
        raw_text = None

        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        for enc in encodings_to_try:
            try:
                raw_text = raw_bytes.decode(enc)
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if raw_text is None:
            # Fallback with error replacement
            raw_text = raw_bytes.decode("utf-8", errors="replace")

        cleaned = clean_extracted_text(raw_text)
        if not cleaned:
            raise ValueError(f"Text file '{filename}' is empty or contains only unreadable characters.")

        return [
            DocumentContent(
                text=cleaned,
                metadata={
                    "filename": filename,
                    "source": filename,
                    "format": "txt"
                }
            )
        ]
