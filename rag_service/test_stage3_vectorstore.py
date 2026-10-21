# rag_service/test_stage3_vectorstore.py - Stage 3 Verification Test Suite
# Tests ChromaDB persistent vector store, SentenceTransformers 384-dim embeddings, metadata storage, and lifecycle management.

import sys
import numpy as np
import chromadb
from config import CHROMA_PERSIST_DIR, COLLECTION_NAME, EMBEDDING_MODEL_NAME
from vector_store import vector_store

def run_stage3_verification():
    print("==================================================================")
    print("       LIFELINK RAG PIPELINE: STAGE 3 VECTOR STORE VERIFICATION   ")
    print("==================================================================")
    passed_tests = 0
    total_tests = 5

    test_health_id = "LL-STAGE3-VERIFY"

    # Clean up any leftover test data prior to start
    vector_store.delete_patient_records(test_health_id)

    # ------------------------------------------------------------------
    # TEST 1: Embedding Model Architecture & Vector Dimensionality
    # ------------------------------------------------------------------
    print("\n[TEST 1] Embedding Model Architecture & Dimensionality...")
    sample_texts = [
        "Fasting blood glucose: 92 mg/dL. Normal metabolic control.",
        "Patient prescribed Azithromycin 250mg oral tablets daily."
    ]
    embeddings = vector_store.model.encode(sample_texts, normalize_embeddings=True)
    
    assert embeddings.shape[0] == 2, f"Expected 2 embeddings, got {embeddings.shape[0]}"
    assert embeddings.shape[1] == 384, f"Expected 384 dimensions for all-MiniLM-L6-v2, got {embeddings.shape[1]}"
    
    # Check unit vector normalization (norm should be ~1.0)
    norm_0 = float(np.linalg.norm(embeddings[0]))
    norm_1 = float(np.linalg.norm(embeddings[1]))
    assert abs(norm_0 - 1.0) < 1e-4, f"Vector 0 is not normalized: norm = {norm_0}"
    assert abs(norm_1 - 1.0) < 1e-4, f"Vector 1 is not normalized: norm = {norm_1}"

    print(f"-> PASSED: Verified {EMBEDDING_MODEL_NAME} produces normalized 384-dimensional dense vectors.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 2: ChromaDB Persistent Collection Ingestion (Batch Upsert)
    # ------------------------------------------------------------------
    print("\n[TEST 2] Ingesting Clinical Chunks with Rich Metadata...")
    initial_stats = vector_store.get_stats()
    initial_count = initial_stats["total_chunks"]

    test_chunks = [
        {
            "chunk_id": f"doc_301_p1_c1_{test_health_id}",
            "text": "LABORATORY PANEL: Total White Blood Cell count 6,200 /mcL (Reference: 4,000 - 11,000 /mcL). Platelet count 245,000 /mcL.",
            "document_id": 301,
            "health_id": test_health_id,
            "file_name": "complete_blood_count.pdf",
            "category": "Lab Report",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 122
        },
        {
            "chunk_id": f"doc_301_p1_c2_{test_health_id}",
            "text": "METABOLIC PANEL: Serum Creatinine 0.88 mg/dL with estimated GFR > 90 mL/min/1.73m2. Serum Electrolytes within normal limits.",
            "document_id": 301,
            "health_id": test_health_id,
            "file_name": "complete_blood_count.pdf",
            "category": "Lab Report",
            "page_number": 1,
            "chunk_index": 2,
            "char_count": 125
        },
        {
            "chunk_id": f"doc_302_p1_c1_{test_health_id}",
            "text": "CARDIOLOGY CONSULTATION: Resting heart rate 72 bpm, blood pressure 118/74 mmHg. Normal sinus rhythm on 12-lead ECG.",
            "document_id": 302,
            "health_id": test_health_id,
            "file_name": "cardiology_evaluation.pdf",
            "category": "Cardiology",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 116
        },
        {
            "chunk_id": f"doc_302_p1_c2_{test_health_id}",
            "text": "DISCHARGE PLAN: Continue low sodium dietary regimen. Routine clinical review scheduled in 6 months.",
            "document_id": 302,
            "health_id": test_health_id,
            "file_name": "cardiology_evaluation.pdf",
            "category": "Cardiology",
            "page_number": 1,
            "chunk_index": 2,
            "char_count": 100
        }
    ]

    indexed_count = vector_store.index_chunks(test_chunks)
    assert indexed_count == 4, f"Expected 4 chunks indexed, got {indexed_count}"

    updated_stats = vector_store.get_stats()
    assert updated_stats["total_chunks"] >= initial_count + 4, "Total collection chunk count did not increase by 4"

    print(f"-> PASSED: Ingested 4 chunks across 2 documents. Collection total: {updated_stats['total_chunks']} chunks.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 3: Metadata Retrieval & Type Preservation
    # ------------------------------------------------------------------
    print("\n[TEST 3] Inspecting Stored Metadata & Provenance...")
    doc301_chunks = vector_store.get_document_chunks(document_id=301, health_id=test_health_id)
    assert len(doc301_chunks) == 2, f"Expected 2 chunks for document 301, got {len(doc301_chunks)}"

    for item in doc301_chunks:
        meta = item["metadata"]
        assert meta["document_id"] == 301
        assert meta["health_id"] == test_health_id
        assert meta["file_name"] == "complete_blood_count.pdf"
        assert meta["category"] == "Lab Report"
        assert meta["page_number"] == 1
        assert "LABORATORY PANEL" in item["text"] or "METABOLIC PANEL" in item["text"]

    print(f"-> PASSED: Verified 100% metadata preservation and clinical text integrity for document 301.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 4: Disk Persistence Across Independent Client Session
    # ------------------------------------------------------------------
    print("\n[TEST 4] Verifying On-Disk Persistence (Cold Client Reload)...")
    # Open a completely fresh ChromaDB client pointing to the same directory
    cold_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    cold_collection = cold_client.get_collection(COLLECTION_NAME)

    cold_results = cold_collection.get(
        where={"health_id": test_health_id},
        include=["metadatas", "documents"]
    )
    assert len(cold_results["ids"]) == 4, f"Expected 4 chunks found on disk, got {len(cold_results['ids'])}"
    
    print(f"-> PASSED: Independent Chroma client verified 4/4 vectors stored permanently on disk at '{CHROMA_PERSIST_DIR}'.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 5: Document Deletion & Patient Isolation
    # ------------------------------------------------------------------
    print("\n[TEST 5] Document Lifecycle Deletion & Isolation...")
    # Delete Document 301
    del_result = vector_store.delete_document(document_id=301, health_id=test_health_id)
    assert del_result == 1, "delete_document should return 1 on success"

    # Document 301 chunks should now be 0
    remaining_301 = vector_store.get_document_chunks(document_id=301, health_id=test_health_id)
    assert len(remaining_301) == 0, f"Expected 0 chunks for deleted doc 301, got {len(remaining_301)}"

    # Document 302 chunks should still be intact (2 chunks)
    remaining_302 = vector_store.get_document_chunks(document_id=302, health_id=test_health_id)
    assert len(remaining_302) == 2, f"Expected 2 chunks remaining for doc 302, got {len(remaining_302)}"

    # Complete cleanup of test patient records
    cleanup_result = vector_store.delete_patient_records(test_health_id)
    assert cleanup_result == 1, "delete_patient_records should return 1"
    
    final_test_chunks = vector_store.get_document_chunks(document_id=302, health_id=test_health_id)
    assert len(final_test_chunks) == 0, "All test chunks should be removed after cleanup"

    print("-> PASSED: Document 301 deleted cleanly, Document 302 remained isolated, and test data cleaned up.")
    passed_tests += 1

    print("\n==================================================================")
    print(f"VERIFICATION RESULT: ALL {passed_tests}/{total_tests} STAGE 3 TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_stage3_verification()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n-> FAILED ASSERTION: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n-> ERROR DURING VERIFICATION: {e}")
        sys.exit(1)
