import re
from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

class MarkdownLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            raw_text = f.read()

        cleaned = clean_extracted_text(raw_text)
        if not cleaned:
            raise ValueError(f"Markdown file '{filename}' contains no content.")

        # Split markdown into logical sections based on top-level headers (# or ##)
        # while keeping the headings with the text
        sections = re.split(r"(?=(?:^|\n)#{1,3}\s+)", cleaned)
        contents: List[DocumentContent] = []

        for section in sections:
            sec_text = section.strip()
            if not sec_text:
                continue

            # Determine section title if available
            heading_match = re.match(r"^#{1,3}\s+(.+)$", sec_text, re.MULTILINE)
            section_title = heading_match.group(1).strip() if heading_match else "General"

            contents.append(
                DocumentContent(
                    text=sec_text,
                    metadata={
                        "filename": filename,
                        "source": filename,
                        "section": section_title,
                        "format": "markdown"
                    }
                )
            )

        if not contents:
            contents.append(
                DocumentContent(
                    text=cleaned,
                    metadata={"filename": filename, "source": filename, "format": "markdown"}
                )
            )

        return contents
