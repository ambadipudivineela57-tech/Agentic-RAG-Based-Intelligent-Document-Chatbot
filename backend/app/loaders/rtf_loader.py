from typing import List
from striprtf.striprtf import rtf_to_text
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class RTFLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        # Try utf-8 then cp1252 / latin-1 for RTF raw string
        text_content = ""
        for enc in ["utf-8", "cp1252", "latin-1"]:
            try:
                decoded_str = raw_bytes.decode(enc)
                text_content = rtf_to_text(decoded_str)
                break
            except Exception:
                continue

        if not text_content:
            try:
                decoded_str = raw_bytes.decode("utf-8", errors="ignore")
                text_content = rtf_to_text(decoded_str)
            except Exception as e:
                raise ValueError(f"Failed to extract RTF text from '{filename}': {str(e)}")

        cleaned = clean_extracted_text(text_content)
        if not cleaned:
            raise ValueError(f"RTF file '{filename}' contains no readable text.")

        return [
            DocumentContent(
                text=cleaned,
                metadata={
                    "filename": filename,
                    "source": filename,
                    "format": "rtf"
                }
            )
        ]
