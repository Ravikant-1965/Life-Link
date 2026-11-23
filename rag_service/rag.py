# rag_service/rag.py
from typing import List, Dict, Any
from vector_store import vector_store
from Utilities.utilities import log

def search(query: str, top_k: int = 2) -> List[Dict[str, Any]]:
    """
    Searches the LifeLink ChromaDB medical vector store / knowledge base.
    """
    try:
        chunks = vector_store.search_chunks(query=query, top_k=top_k)
        results = []
        for c in chunks:
            results.append({
                "source": c.get("file_name", "Medical Record"),
                "chunk_id": c.get("chunk_id", 1),
                "text": c.get("text", ""),
                "score": float(c.get("similarity", 0.0))
            })
        return results
    except Exception as e:
        log(f"Error during vector store search: {e}")
        return []
