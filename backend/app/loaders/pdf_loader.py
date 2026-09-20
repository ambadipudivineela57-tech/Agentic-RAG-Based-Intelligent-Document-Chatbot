import pypdf
from typing import List
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.core.config import settings
from backend.app.utils.text_cleaner import clean_extracted_text

class PDFLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        contents: List[DocumentContent] = []
        total_extracted_text_length = 0

        try:
            reader = pypdf.PdfReader(file_path)
            num_pages = len(reader.pages)

            for page_idx, page in enumerate(reader.pages):
                page_number = page_idx + 1
                raw_text = page.extract_text() or ""
                cleaned = clean_extracted_text(raw_text)

                if cleaned:
                    total_extracted_text_length += len(cleaned)
                    contents.append(
                        DocumentContent(
                            text=cleaned,
                            metadata={
                                "filename": filename,
                                "source": filename,
                                "page": page_number,
                                "total_pages": num_pages,
                            }
                        )
                    )

            # Check if PDF appears scanned / image-only (no extractable text)
            if total_extracted_text_length < 20 and num_pages > 0:
                if settings.OCR_ENABLED:
                    # If OCR enabled, attempt pytesseract if installed
                    try:
                        import pytesseract
                        from pdf2image import convert_from_path
                        images = convert_from_path(file_path)
                        for page_idx, img in enumerate(images):
                            ocr_text = pytesseract.image_to_string(img)
                            cleaned_ocr = clean_extracted_text(ocr_text)
                            if cleaned_ocr:
                                contents.append(
                                    DocumentContent(
                                        text=cleaned_ocr,
                                        metadata={
                                            "filename": filename,
                                            "source": filename,
                                            "page": page_idx + 1,
                                            "total_pages": len(images),
                                            "ocr": True,
                                        }
                                    )
                                )
                    except Exception as ocr_err:
                        raise ValueError(
                            f"OCR processing failed: {str(ocr_err)}. Please upload a text-based PDF."
                        )
                else:
                    raise ValueError(
                        "This PDF appears to contain scanned images and no extractable text. "
                        "Please enable OCR support or upload a text-based PDF."
                    )

            if not contents:
                raise ValueError("No extractable text found in PDF document.")

            return contents

        except Exception as e:
            if "scanned images and no extractable text" in str(e):
                raise
            raise ValueError(f"Failed to parse PDF '{filename}': {str(e)}")
