# rag_service/document_loader.py - Stage 1: Document Ingestion & Text Extraction (Python)
import io
import re
from typing import List, Dict, Any
from pypdf import PdfReader

def clean_medical_text(text: str) -> str:
    """
    Normalizes extracted medical text by stripping junk control characters,
    unifying whitespace, while preserving clinical terms, units, and ranges.
    """
    if not text:
        return ""
    
    # Replace non-standard whitespace
    cleaned = re.sub(r'[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]', ' ', text)
    # Strip unprintable control characters
    cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned)
    # Collapse 3+ newlines into 2
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    
    lines = [line.rstrip() for line in cleaned.split('\n')]
    return '\n'.join(lines).strip()

def extract_text_from_pdf_bytes(pdf_bytes: bytes, file_name: str = "") -> Dict[str, Any]:
    """
    Parses PDF bytes into structured, page-indexed medical text.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_data: List[Dict[str, Any]] = []
        
        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            raw_text = page.extract_text() or ""
            cleaned = clean_medical_text(raw_text)
            pages_data.append({
                "page_number": page_num,
                "text": cleaned,
                "char_count": len(cleaned)
            })
            
        full_text = "\n\n".join(
            f"[Page {p['page_number']}]\n{p['text']}" if len(pages_data) > 1 else p['text']
            for p in pages_data
        )
        
        return {
            "success": True,
            "file_name": file_name,
            "total_pages": len(pages_data),
            "pages": pages_data,
            "full_text": full_text,
            "char_count": len(full_text)
        }
    except Exception as exc:
        return {
            "success": False,
            "file_name": file_name,
            "error": str(exc),
            "total_pages": 0,
            "pages": [],
            "full_text": "",
            "char_count": 0
        }

def extract_text_from_bytes(data: bytes, file_name: str = "", mime_type: str = "") -> Dict[str, Any]:
    """
    Extracts text from raw bytes based on file type.
    """
    lower_name = file_name.lower()
    if mime_type == "application/pdf" or lower_name.endswith(".pdf"):
        return extract_text_from_pdf_bytes(data, file_name)
    
    if mime_type.startswith("text/") or lower_name.endswith((".txt", ".md", ".csv", ".json")):
        try:
            text = clean_medical_text(data.decode("utf-8", errors="replace"))
            return {
                "success": True,
                "file_name": file_name,
                "total_pages": 1,
                "pages": [{"page_number": 1, "text": text, "char_count": len(text)}],
                "full_text": text,
                "char_count": len(text)
            }
        except Exception as exc:
            return {"success": False, "file_name": file_name, "error": str(exc), "total_pages": 0, "pages": [], "full_text": "", "char_count": 0}
            
    # Image or generic attachment notice
    notice = f"[Medical Record Attachment: {file_name}]"
    return {
        "success": True,
        "file_name": file_name,
        "total_pages": 1,
        "pages": [{"page_number": 1, "text": notice, "char_count": len(notice)}],
        "full_text": notice,
        "char_count": len(notice)
    }
