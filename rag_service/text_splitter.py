# rag_service/text_splitter.py - Stage 2: Medical Text Splitting & Metadata Tagging
# Provides recursive, clinical-aware text splitting preserving medical ranges, dosages, and page provenance.

from typing import List, Dict, Any, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import CHUNK_SIZE, CHUNK_OVERLAP

# Clinical-aware separator hierarchy:
# 1. Double line breaks (section boundaries, paragraphs)
# 2. Single line breaks (clinical list items, lab rows, vital sign entries)
# 3. Sentence terminators followed by space (clinical narrative stops)
# 4. Semicolons and commas (compound clinical findings, medication lists)
# 5. Spaces and character fallbacks
MEDICAL_SEPARATORS = [
    "\n\n",
    "\n",
    ". ",
    "? ",
    "! ",
    "; ",
    ", ",
    " ",
    ""
]

def create_medical_splitter(
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> RecursiveCharacterTextSplitter:
    """
    Constructs a RecursiveCharacterTextSplitter configured with clinical separators.
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=MEDICAL_SEPARATORS,
        length_function=len,
        is_separator_regex=False
    )

def split_document_pages(
    pages: List[Dict[str, Any]],
    document_id: int,
    health_id: str,
    file_name: str,
    category: str = "General",
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
    include_header: bool = False
) -> List[Dict[str, Any]]:
    """
    Splits page-indexed text into overlapping clinical chunks while attaching rich metadata.
    
    Args:
        pages: List of dicts with 'page_number' and 'text'.
        document_id: Unique database ID of the document.
        health_id: Patient portable Health ID (e.g. LL-2KZAM).
        file_name: Original file name.
        category: Clinical category (e.g. 'Lab Report', 'Prescription').
        chunk_size: Maximum characters per chunk (default from config).
        chunk_overlap: Overlapping characters between consecutive chunks.
        include_header: If True, prefixes the chunk with document/page context.
        
    Returns:
        List of chunk dictionaries with rich provenance metadata.
    """
    splitter = create_medical_splitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks: List[Dict[str, Any]] = []
    chunk_counter = 0

    for page in pages:
        page_num = page.get("page_number", 1)
        page_text = page.get("text", "").strip()

        if not page_text:
            continue

        raw_chunks = splitter.split_text(page_text)

        for idx, text_segment in enumerate(raw_chunks):
            cleaned_segment = text_segment.strip()
            if cleaned_segment.startswith(". "):
                cleaned_segment = cleaned_segment[2:].strip()
            elif cleaned_segment.startswith((".", ";", ",")):
                cleaned_segment = cleaned_segment[1:].strip()

            if not cleaned_segment:
                continue

            chunk_counter += 1
            chunk_id = f"doc_{document_id}_p{page_num}_c{idx + 1}"

            final_text = cleaned_segment
            if include_header:
                final_text = f"[{file_name} | Page {page_num}]\n{cleaned_segment}"

            chunks.append({
                "chunk_id": chunk_id,
                "text": final_text,
                "document_id": document_id,
                "health_id": health_id,
                "file_name": file_name,
                "category": category,
                "page_number": page_num,
                "chunk_index": chunk_counter,
                "char_count": len(final_text)
            })

    return chunks

def split_raw_text(
    raw_text: str,
    document_id: int,
    health_id: str,
    file_name: str,
    category: str = "General",
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> List[Dict[str, Any]]:
    """
    Convenience method to split unpaged raw clinical text into chunks.
    """
    pages = [{"page_number": 1, "text": raw_text}]
    return split_document_pages(
        pages=pages,
        document_id=document_id,
        health_id=health_id,
        file_name=file_name,
        category=category,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

def get_chunk_summary(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculates summary statistics across a set of generated chunks.
    """
    if not chunks:
        return {
            "total_chunks": 0,
            "total_chars": 0,
            "avg_chunk_size": 0,
            "min_chunk_size": 0,
            "max_chunk_size": 0,
            "pages_covered": 0
        }

    sizes = [c["char_count"] for c in chunks]
    pages = set(c["page_number"] for c in chunks)

    return {
        "total_chunks": len(chunks),
        "total_chars": sum(sizes),
        "avg_chunk_size": round(sum(sizes) / len(sizes), 1),
        "min_chunk_size": min(sizes),
        "max_chunk_size": max(sizes),
        "pages_covered": len(pages)
    }
