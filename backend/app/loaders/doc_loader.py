import subprocess
import shutil
from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class DOCLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        # Check if antiword or catdoc is installed on system
        converter = shutil.which("antiword") or shutil.which("catdoc")
        if converter:
            try:
                result = subprocess.run(
                    [converter, file_path],
                    capture_output=True,
                    text=True,
                    check=True
                )
                text = clean_extracted_text(result.stdout)
                if text:
                    return [
                        DocumentContent(
                            text=text,
                            metadata={"filename": filename, "source": filename, "format": "doc"}
                        )
                    ]
            except Exception as ex:
                raise ValueError(f"Legacy DOC extractor failed: {str(ex)}")

        # If system converter is not available:
        raise ValueError(
            f"Legacy binary Microsoft Word (.doc) processing is unavailable in this environment. "
            f"Please convert '{filename}' to modern .docx or .pdf format for full parsing."
        )
