from typing import List, Any
import defusedxml.ElementTree as ET
from backend.app.loaders.base_loader import BaseDocumentLoader, DocumentContent
from backend.app.utils.text_cleaner import clean_extracted_text

def flatten_xml_element(element: Any, path: str = "") -> List[str]:
    """
    Traverses XML hierarchy producing clean, hierarchical tag-value lines.
    """
    lines: List[str] = []
    tag_name = element.tag.split("}")[-1]  # Remove namespace if present
    current_path = f"{path}/{tag_name}" if path else tag_name

    # Include attributes if present
    if element.attrib:
        attr_str = ", ".join(f"{k}='{v}'" for k, v in element.attrib.items())
        lines.append(f"<{current_path} [{attr_str}]>")

    text_val = (element.text or "").strip()
    if text_val:
        lines.append(f"{current_path}: {text_val}")

    for child in element:
        lines.extend(flatten_xml_element(child, current_path))

    return lines

class XMLLoader(BaseDocumentLoader):
    def load(self, file_path: str, filename: str) -> List[DocumentContent]:
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            lines = flatten_xml_element(root)
            if not lines:
                raise ValueError(f"XML file '{filename}' contains no extractable elements or text.")

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
                            "section": f"Nodes {i + 1}-{min(i + block_size, len(lines))}",
                            "format": "xml"
                        }
                    )
                )

            return contents

        except ET.ParseError as pe:
            raise ValueError(f"XML parsing error in '{filename}': {str(pe)}")
        except Exception as e:
            raise ValueError(f"Failed to process XML file '{filename}': {str(e)}")
