import re
import unicodedata

def clean_extracted_text(text: str) -> str:
    """
    Cleans raw extracted text while strictly preserving headings,
    paragraphs, code blocks, lists, and table structures.
    """
    if not text:
        return ""

    # Normalize unicode to NFKC
    text = unicodedata.normalize("NFKC", text)

    # Replace null bytes or non-printable control characters except tab, newline, carriage return
    text = "".join(ch for ch in text if ch in ("\n", "\r", "\t") or (ord(ch) >= 32 and ord(ch) != 127))

    # Normalize Windows CRLF / old Mac CR to standard Unix newline LF
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace 3 or more consecutive newlines with 2 newlines (preserve paragraph separation)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Trim trailing whitespaces from individual lines while keeping indentation
    lines = [line.rstrip() for line in text.split("\n")]
    cleaned_text = "\n".join(lines).strip()

    return cleaned_text
