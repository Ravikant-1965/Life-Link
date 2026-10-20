# rag_service/config.py - LifeLink Python RAG Service Configuration
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / "backend" / ".env")

HOST = os.getenv("RAG_HOST", "127.0.0.1")
PORT = int(os.getenv("RAG_PORT", "8000"))
CHROMA_PERSIST_DIR = str(BASE_DIR / "chroma_data")
EMBEDDING_MODEL_NAME = os.getenv("RAG_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
COLLECTION_NAME = "lifelink_medical_records"
CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "600"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "100"))
