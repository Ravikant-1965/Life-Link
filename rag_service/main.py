# rag_service/main.py - LifeLink Python FastAPI RAG Microservice
import os
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import HOST, PORT
from document_loader import extract_text_from_bytes, clean_medical_text
from text_splitter import split_document_pages
from vector_store import vector_store
from rag_engine import generate_rag_answer

app = FastAPI(
    title="LifeLink Python RAG Medical Service",
    version="1.0.0",
    description="Dedicated Python RAG microservice using ChromaDB, SentenceTransformers, and LangChain."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextIndexRequest(BaseModel):
    document_id: int
    health_id: str
    file_name: str
    category: str = "General"
    text: str

class DeleteDocumentRequest(BaseModel):
    document_id: int
    health_id: str

class QueryRequest(BaseModel):
    query: str
    health_id: str
    top_k: int = 4
    category: Optional[str] = None

class ChatRequest(BaseModel):
    query: str
    health_id: str
    patient_name: str = "Patient"
    patient_profile: Optional[Dict[str, Any]] = None
    top_k: int = 4

@app.get("/health")
def health_check():
    stats = vector_store.get_stats()
    return {
        "status": "healthy",
        "service": "LifeLink Python RAG Engine",
        "stats": stats
    }

@app.post("/documents/index-file")
async def index_document_file(
    document_id: int = Form(...),
    health_id: str = Form(...),
    file_name: str = Form(...),
    category: str = Form("General"),
    file: UploadFile = File(...)
):
    """
    Stage 1 + 2 + 3: Ingests uploaded PDF or text file, extracts text, chunks it, and indexes in ChromaDB.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    extracted = extract_text_from_bytes(file_bytes, file_name, file.content_type or "")
    if not extracted.get("success"):
        raise HTTPException(status_code=500, detail=f"Failed to parse document: {extracted.get('error')}")

    pages = extracted.get("pages", [])
    chunks = split_document_pages(
        pages=pages,
        document_id=document_id,
        health_id=health_id,
        file_name=file_name,
        category=category
    )

    indexed_count = vector_store.index_chunks(chunks)

    return {
        "success": True,
        "document_id": document_id,
        "health_id": health_id,
        "file_name": file_name,
        "total_pages": extracted.get("total_pages", 1),
        "total_chunks": indexed_count,
        "char_count": extracted.get("char_count", 0)
    }

@app.post("/documents/index-text")
def index_document_text(req: TextIndexRequest):
    """
    Indexes raw extracted medical text into ChromaDB chunks.
    """
    cleaned = clean_medical_text(req.text)
    pages = [{"page_number": 1, "text": cleaned, "char_count": len(cleaned)}]

    chunks = split_document_pages(
        pages=pages,
        document_id=req.document_id,
        health_id=req.health_id,
        file_name=req.file_name,
        category=req.category
    )

    indexed_count = vector_store.index_chunks(chunks)

    return {
        "success": True,
        "document_id": req.document_id,
        "health_id": req.health_id,
        "total_chunks": indexed_count
    }

@app.post("/documents/delete")
def delete_document(req: DeleteDocumentRequest):
    """
    Removes vector chunks from ChromaDB for a deleted document.
    """
    deleted = vector_store.delete_document(req.document_id, req.health_id)
    return {
        "success": True,
        "document_id": req.document_id,
        "health_id": req.health_id,
        "deleted": deleted
    }

@app.post("/query")
def query_chunks(req: QueryRequest):
    """
    Semantic vector retrieval strictly filtered by patient health_id.
    """
    results = vector_store.search_chunks(
        query=req.query,
        health_id=req.health_id,
        top_k=req.top_k,
        category=req.category
    )
    return {
        "query": req.query,
        "health_id": req.health_id,
        "count": len(results),
        "results": results
    }

@app.post("/chat")
async def chat_rag(req: ChatRequest):
    """
    Complete RAG Chat: retrieves matching document chunks and synthesizes answer with citations.
    """
    chunks = vector_store.search_chunks(
        query=req.query,
        health_id=req.health_id,
        top_k=req.top_k
    )

    response = await generate_rag_answer(
        query=req.query,
        retrieved_chunks=chunks,
        patient_profile=req.patient_profile,
        patient_name=req.patient_name
    )

    return {
        "query": req.query,
        "health_id": req.health_id,
        "answer": response["answer"],
        "sources": response["sources"],
        "engine": response["engine"],
        "grounded": response["grounded"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
