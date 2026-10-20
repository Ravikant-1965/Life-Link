# rag_service/vector_store.py - Stage 3 & 4: ChromaDB Vector Store & Retriever (Python)
import os
from typing import List, Dict, Any, Optional
import chromadb
from sentence_transformers import SentenceTransformer
from config import CHROMA_PERSIST_DIR, COLLECTION_NAME, EMBEDDING_MODEL_NAME

class VectorStore:
    def __init__(self):
        os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
        self.client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        
        # Initialize SentenceTransformer embedding model (runs 100% locally on CPU / Metal)
        print(f"[VectorStore] Loading embedding model: {EMBEDDING_MODEL_NAME}...")
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        print("[VectorStore] Embedding model loaded successfully.")
        
        # Get or create collection configured with cosine distance
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )

    def index_chunks(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Embeds and stores clinical chunks with metadata in ChromaDB.
        """
        if not chunks:
            return 0
            
        ids = [c["chunk_id"] for c in chunks]
        texts = [c["text"] for c in chunks]
        metadatas = [
            {
                "document_id": c["document_id"],
                "health_id": c["health_id"],
                "file_name": c["file_name"],
                "category": c["category"],
                "page_number": c["page_number"],
                "chunk_index": c["chunk_index"],
                "char_count": c["char_count"]
            }
            for c in chunks
        ]
        
        # Generate dense embeddings (384 dimensions)
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
        
        # Upsert into ChromaDB
        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        
        return len(chunks)

    def search_chunks(
        self,
        query: str,
        health_id: str,
        top_k: int = 4,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes semantic vector similarity search filtered strictly by patient health_id.
        """
        if not query.strip():
            return []

        query_embedding = self.model.encode([query], normalize_embeddings=True, show_progress_bar=False).tolist()[0]
        
        where_filter: Dict[str, Any] = {"health_id": health_id}
        if category:
            where_filter = {
                "$and": [
                    {"health_id": health_id},
                    {"category": category}
                ]
            }

        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as exc:
            print(f"[VectorStore Error] Query failed: {exc}")
            return []

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]

        ranked_results: List[Dict[str, Any]] = []
        for i in range(len(documents)):
            # Convert cosine distance to similarity score: similarity = 1 - distance
            dist = distances[i] if i < len(distances) else 1.0
            similarity = round(max(0.0, 1.0 - dist), 4)

            ranked_results.append({
                "chunk_id": ids[i],
                "text": documents[i],
                "similarity": similarity,
                "document_id": metadatas[i].get("document_id"),
                "file_name": metadatas[i].get("file_name"),
                "category": metadatas[i].get("category"),
                "page_number": metadatas[i].get("page_number"),
                "chunk_index": metadatas[i].get("chunk_index")
            })

        return ranked_results

    def delete_document(self, document_id: int, health_id: str) -> int:
        """
        Deletes all chunks belonging to a document under a specific patient.
        """
        try:
            where_filter = {
                "$and": [
                    {"document_id": document_id},
                    {"health_id": health_id}
                ]
            }
            self.collection.delete(where=where_filter)
            return 1
        except Exception as exc:
            print(f"[VectorStore Error] Delete failed: {exc}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """
        Returns stats about stored vectors.
        """
        return {
            "collection_name": COLLECTION_NAME,
            "total_chunks": self.collection.count(),
            "persist_directory": CHROMA_PERSIST_DIR,
            "embedding_model": EMBEDDING_MODEL_NAME
        }

# Global singleton instance
vector_store = VectorStore()
