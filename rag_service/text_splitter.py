# rag_service/text_splitter.py - Stage 2: Medical Text Splitting & Metadata Tagging (Python)
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import CHUNK_SIZE, CHUNK_OVERLAP

# Clinical-aware separator hierarchy: prioritizes section breaks, line breaks, sentence stops, then words
MEDICAL_SEPARATORS = [
    "\n\n",
    "\n",
    ". ",
    "; ",
    ", ",
    " ",
    ""
]

def split_document_pages(
    pages: List[Dict[str, Any]],
    document_id: int,
    health_id: str,
    file_name: str,
    category: str = "General",
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP
) -> List[Dict[str, Any]]:
    """
    Splits page-indexed text into overlapping clinical chunks while attaching rich metadata.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=MEDICAL_SEPARATORS,
        length_function=len,
        is_separator_regex=False
    )
    
    chunks: List[Dict[str, Any]] = []
    chunk_counter = 0

    for page in pages:
        page_num = page.get("page_number", 1)
        page_text = page.get("text", "").strip()
        
        if not page_text:
            continue
            
        page_chunks = splitter.split_text(page_text)
        
        for idx, text_chunk in enumerate(page_chunks):
            chunk_counter += 1
            chunk_id = f"doc_{document_id}_p{page_num}_c{idx + 1}"
            
            chunks.append({
                "chunk_id": chunk_id,
                "text": text_chunk,
                "document_id": document_id,
                "health_id": health_id,
                "file_name": file_name,
                "category": category,
                "page_number": page_num,
                "chunk_index": chunk_counter,
                "char_count": len(text_chunk)
            })

    return chunks
