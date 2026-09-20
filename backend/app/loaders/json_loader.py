import json
from typing import List, Any, Dict
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

def flatten_json(data: Any, prefix: str = "") -> List[str]:
    """
    Recursively flattens JSON structures into searchable dot-notation key-value lines.
    """
    lines: List[str] = []

    if isinstance(data, dict):
        for key, value in data.items():
            new_prefix = f"{prefix}.{key}" if prefix else str(key)
            lines.extend(flatten_json(value, new_prefix))
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            new_prefix = f"{prefix}[{idx}]"
            lines.extend(flatten_json(item, new_prefix))
    else:
        lines.append(f"{prefix}: {data}")

    return lines

class JSONLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                data = json.load(f)

            lines = flatten_json(data)
            if not lines:
                raise ValueError(f"JSON file '{filename}' contains empty data.")

            # Chunk into reasonable blocks (e.g. 50 key-value pairs per content block)
            contents: List[DocumentContent] = []
            block_size = 50

            for i in range(0, len(lines), block_size):
                block_lines = lines[i:i + block_size]
                text = clean_extracted_text("\n".join(block_lines))
                contents.append(
                    DocumentContent(
                        text=text,
                        metadata={
                            "filename": filename,
                            "source": filename,
                            "section": f"Keys {i + 1}-{min(i + block_size, len(lines))}",
                            "format": "json"
                        }
                    )
                )

            return contents

        except json.JSONDecodeError as jde:
            raise ValueError(f"Invalid JSON in file '{filename}': {str(jde)}")
        except Exception as e:
            raise ValueError(f"Failed to process JSON file '{filename}': {str(e)}")
