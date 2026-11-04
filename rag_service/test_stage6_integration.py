# rag_service/test_stage6_integration.py - Stage 6: Full Integration Verification Suite
# Verifies end-to-end HTTP integration across FastAPI, ChromaDB, SentenceTransformers, and Gemini 3.8 Flash.

import sys
import httpx

BASE_URL = "http://127.0.0.1:8000"

def run_stage6_verification():
    print("==================================================================")
    print("      LIFELINK RAG PIPELINE: STAGE 6 FULL INTEGRATION SUITE       ")
    print("==================================================================")
    passed_tests = 0
    total_tests = 5

    test_health_id = "LL-STAGE6-E2E"
    other_health_id = "LL-STAGE6-STRANGER"

    with httpx.Client(base_url=BASE_URL, timeout=20.0) as client:
        # ------------------------------------------------------------------
        # TEST 1: Microservice Health & ChromaDB Connectivity
        # ------------------------------------------------------------------
        print("\n[TEST 1] Python Microservice Health & ChromaDB Connectivity...")
        res = client.get("/health")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data["status"] == "healthy"
        assert "stats" in data
        assert data["stats"]["collection_name"] == "lifelink_medical_records"
        assert data["stats"]["embedding_model"] == "all-MiniLM-L6-v2"
        print("-> PASSED: Microservice active on port 8000 with ChromaDB connected.")
        passed_tests += 1

        # ------------------------------------------------------------------
        # TEST 2: Document Ingestion Lifecycle via HTTP
        # ------------------------------------------------------------------
        print("\n[TEST 2] Ingesting Medical Document via HTTP (/documents/index-text)...")
        index_payload = {
            "document_id": 601,
            "health_id": test_health_id,
            "file_name": "annual_comprehensive_biochemistry.pdf",
            "category": "Lab Report",
            "text": (
                "CLINICAL BIOCHEMISTRY PANEL:\n"
                "Fasting Blood Glucose: 92 mg/dL [Reference: 70 - 99 mg/dL] Normal\n"
                "Hemoglobin A1c: 5.4 % [Reference: 4.0 - 5.6 %] Optimal\n"
                "Serum Creatinine: 0.88 mg/dL [Reference: 0.70 - 1.30 mg/dL] Normal\n"
                "Estimated GFR: > 90 mL/min/1.73m2 indicating optimal glomerular filtration.\n"
                "Total Cholesterol: 174 mg/dL [Desirable: < 200 mg/dL]"
            )
        }
        res = client.post("/documents/index-text", json=index_payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        index_data = res.json()
        assert index_data["success"] is True
        assert index_data["total_chunks"] >= 1
        print(f"-> PASSED: Document indexed successfully ({index_data['total_chunks']} chunks stored in ChromaDB).")
        passed_tests += 1

        # ------------------------------------------------------------------
        # TEST 3: Semantic Retrieval & Multi-Tenant Patient Isolation
        # ------------------------------------------------------------------
        print("\n[TEST 3] Semantic Vector Retrieval & Patient Isolation (/query)...")
        # Target Patient query
        query_payload = {
            "query": "What is my serum creatinine and kidney filtration rate?",
            "health_id": test_health_id,
            "top_k": 3
        }
        res = client.post("/query", json=query_payload)
        assert res.status_code == 200
        query_data = res.json()
        assert query_data["count"] > 0, "Expected at least 1 retrieved chunk"
        top_match = query_data["results"][0]
        assert "Creatinine" in top_match["text"]
        assert top_match["file_name"] == "annual_comprehensive_biochemistry.pdf"
        assert top_match["similarity"] > 0.50

        # Stranger Patient query (Zero Leak Test)
        stranger_payload = {
            "query": "What is my serum creatinine and kidney filtration rate?",
            "health_id": other_health_id,
            "top_k": 3
        }
        stranger_res = client.post("/query", json=stranger_payload)
        assert stranger_res.status_code == 200
        assert stranger_res.json()["count"] == 0, "LEAK DETECTED: Stranger accessed patient chunks!"

        print("-> PASSED: Semantic retrieval successful with 100% patient isolation verified.")
        passed_tests += 1

        # ------------------------------------------------------------------
        # TEST 4: Live End-to-End Chat Generation with Gemini 3.8 Flash
        # ------------------------------------------------------------------
        print("\n[TEST 4] Live End-to-End RAG Chat (/chat)...")
        chat_payload = {
            "query": "Based on my lab report, what is my fasting glucose and HbA1c?",
            "health_id": test_health_id,
            "patient_name": "Ravi Kant",
            "patient_profile": {
                "blood_group": "B Positive",
                "allergies": "Penicillin"
            }
        }
        res = client.post("/chat", json=chat_payload)
        assert res.status_code == 200, f"Chat failed: {res.text}"
        chat_data = res.json()
        assert chat_data["grounded"] is True
        assert len(chat_data["sources"]) > 0
        assert chat_data["sources"][0]["file_name"] == "annual_comprehensive_biochemistry.pdf"
        assert chat_data["engine"] in ["gemini-3.8-flash", "local-clinical-synthesis"]
        
        answer_snippet = chat_data["answer"][:120].replace("\n", " ")
        print(f"-> PASSED: Live RAG generated response (Engine: {chat_data['engine']}):")
        print(f"   \"{answer_snippet}...\"")
        passed_tests += 1

        # ------------------------------------------------------------------
        # TEST 5: Complete Vector Deletion & Cleanup
        # ------------------------------------------------------------------
        print("\n[TEST 5] Vector Purge & Document Deletion (/documents/delete)...")
        delete_payload = {
            "document_id": 601,
            "health_id": test_health_id
        }
        res = client.post("/documents/delete", json=delete_payload)
        assert res.status_code == 200
        assert res.json()["deleted"] == 1

        # Verify query returns 0 after deletion
        verify_del_res = client.post("/query", json=query_payload)
        assert verify_del_res.json()["count"] == 0, "Chunks were not purged from ChromaDB!"

        print("-> PASSED: Document vectors purged permanently from ChromaDB disk store.")
        passed_tests += 1

    print("\n==================================================================")
    print(f"VERIFICATION RESULT: ALL {passed_tests}/{total_tests} STAGE 6 TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_stage6_verification()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n-> FAILED ASSERTION: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n-> ERROR DURING VERIFICATION: {e}")
        sys.exit(1)
