# rag_service/test_stage4_retriever.py - Stage 4 Verification Test Suite
# Tests semantic vector retrieval, strict multi-tenant patient isolation, category filtering, and thresholding.

import sys
from vector_store import vector_store

def run_stage4_verification():
    print("==================================================================")
    print("       LIFELINK RAG PIPELINE: STAGE 4 RETRIEVER VERIFICATION      ")
    print("==================================================================")
    passed_tests = 0
    total_tests = 5

    patient_alice = "LL-PATIENT-ALICE"
    patient_bob = "LL-PATIENT-BOB"

    # Pre-test cleanup
    vector_store.delete_patient_records(patient_alice)
    vector_store.delete_patient_records(patient_bob)

    # ------------------------------------------------------------------
    # SEED DATA FOR STAGE 4 TESTS
    # ------------------------------------------------------------------
    alice_chunks = [
        {
            "chunk_id": "alice_chunk_diabetes",
            "text": "DIAGNOSIS: Patient has Type 2 Diabetes Mellitus diagnosed in 2021. Managed with Metformin 500mg twice daily.",
            "document_id": 401,
            "health_id": patient_alice,
            "file_name": "alice_endocrine_summary.pdf",
            "category": "Endocrinology",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 109
        },
        {
            "chunk_id": "alice_chunk_glucose",
            "text": "LAB RESULTS: Fasting Blood Glucose 142 mg/dL and HbA1c 7.8% indicating uncontrolled hyperglycemia.",
            "document_id": 401,
            "health_id": patient_alice,
            "file_name": "alice_endocrine_summary.pdf",
            "category": "Lab Report",
            "page_number": 2,
            "chunk_index": 2,
            "char_count": 98
        },
        {
            "chunk_id": "alice_chunk_allergy",
            "text": "CRITICAL ALLERGY ALERT: Severe anaphylactic shock and hives reaction to Penicillin and Beta-lactam antibiotics.",
            "document_id": 402,
            "health_id": patient_alice,
            "file_name": "alice_allergies.pdf",
            "category": "Allergy",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 110
        },
        {
            "chunk_id": "alice_chunk_amox_rx",
            "text": "PRESCRIPTION ORDER: Amoxicillin 500mg PO three times daily for 7 days for respiratory infection.",
            "document_id": 403,
            "health_id": patient_alice,
            "file_name": "alice_prescriptions.pdf",
            "category": "Prescription",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 96
        },
        {
            "chunk_id": "alice_chunk_amox_lab",
            "text": "MICROBIOLOGY REPORT: Sputum culture isolated Streptococcus pneumoniae highly susceptible to Amoxicillin.",
            "document_id": 404,
            "health_id": patient_alice,
            "file_name": "alice_microbiology.pdf",
            "category": "Lab Report",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 104
        }
    ]

    bob_chunks = [
        {
            "chunk_id": "bob_chunk_healthy",
            "text": "ANNUAL EXAM: Patient has completely normal fasting blood sugar 86 mg/dL. No diagnosis of diabetes or metabolic disease.",
            "document_id": 410,
            "health_id": patient_bob,
            "file_name": "bob_annual_wellness.pdf",
            "category": "General",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 119
        },
        {
            "chunk_id": "bob_chunk_cardiac",
            "text": "CARDIOLOGY: Resting blood pressure 116/74 mmHg, pulse 68 bpm, no history of hypertension or cardiac complaints.",
            "document_id": 411,
            "health_id": patient_bob,
            "file_name": "bob_cardiac.pdf",
            "category": "Cardiology",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 112
        }
    ]

    vector_store.index_chunks(alice_chunks)
    vector_store.index_chunks(bob_chunks)

    # ------------------------------------------------------------------
    # TEST 1: Strict Multi-Tenant Patient Isolation (Zero Leak)
    # ------------------------------------------------------------------
    print("\n[TEST 1] Strict Multi-Tenant Isolation (Zero Cross-Patient Leak)...")
    # Alice asks about diabetes medication
    alice_results = vector_store.search_chunks(
        query="What medication is prescribed for diabetes?",
        health_id=patient_alice,
        top_k=5
    )
    assert len(alice_results) > 0, "Alice should retrieve her diabetes records"
    assert all(r["health_id"] == patient_alice for r in alice_results), "Leak detected: non-Alice records returned!"
    assert any("Metformin" in r["text"] for r in alice_results), "Alice should retrieve Metformin chunk"

    # Bob asks about diabetes medication
    bob_results = vector_store.search_chunks(
        query="What medication is prescribed for diabetes?",
        health_id=patient_bob,
        top_k=5
    )
    # Bob has NO diabetes medication. His results must NEVER include Alice's Metformin chunk
    assert all(r["health_id"] == patient_bob for r in bob_results), "Leak detected: non-Bob records returned!"
    assert not any("Metformin" in r["text"] for r in bob_results), "CRITICAL LEAK: Alice's Metformin leaked into Bob's query!"

    print("-> PASSED: 100% patient isolation verified. Zero cross-patient record leakage.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 2: Semantic Relevance & Top-K Ranking
    # ------------------------------------------------------------------
    print("\n[TEST 2] Semantic Relevance & Cosine Similarity Ranking...")
    # Glucose query
    glucose_results = vector_store.search_chunks(
        query="What are the latest fasting glucose and blood sugar readings?",
        health_id=patient_alice,
        top_k=3
    )
    top_glucose = glucose_results[0]
    assert "Fasting Blood Glucose" in top_glucose["text"] or "hyperglycemia" in top_glucose["text"]
    assert top_glucose["similarity"] > 0.50, f"Expected similarity > 0.50, got {top_glucose['similarity']}"

    # Allergy query
    allergy_results = vector_store.search_chunks(
        query="Is the patient allergic to Penicillin or any antibiotics?",
        health_id=patient_alice,
        top_k=3
    )
    top_allergy = allergy_results[0]
    assert "Penicillin" in top_allergy["text"] and "anaphylactic" in top_allergy["text"]
    assert top_allergy["similarity"] > 0.55, f"Expected similarity > 0.55, got {top_allergy['similarity']}"

    print(f"-> PASSED: Semantic ranking correctly prioritized relevant chunks (Matches > 55%).")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 3: Category-Filtered Vector Retrieval
    # ------------------------------------------------------------------
    print("\n[TEST 3] Category-Filtered Vector Retrieval...")
    # Filter by Prescription only
    rx_results = vector_store.search_chunks(
        query="Amoxicillin dosage and instructions",
        health_id=patient_alice,
        top_k=5,
        category="Prescription"
    )
    assert len(rx_results) > 0, "Expected prescription results"
    for r in rx_results:
        assert r["category"] == "Prescription", f"Non-prescription category returned: {r['category']}"
        assert "PRESCRIPTION ORDER" in r["text"]

    # Filter by Lab Report only
    lab_results = vector_store.search_chunks(
        query="Amoxicillin culture findings",
        health_id=patient_alice,
        top_k=5,
        category="Lab Report"
    )
    assert len(lab_results) > 0, "Expected lab results"
    for r in lab_results:
        assert r["category"] == "Lab Report", f"Non-lab category returned: {r['category']}"
        assert "MICROBIOLOGY REPORT" in r["text"] or "LAB RESULTS" in r["text"]

    print("-> PASSED: Category filtering accurately isolates target clinical document types.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 4: Minimum Similarity Threshold Filtering
    # ------------------------------------------------------------------
    print("\n[TEST 4] Minimum Similarity Threshold (Low-Relevance Filtering)...")
    irrelevant_query = "What is the capital city of France and current tourism schedule?"
    
    # Without threshold, low similarity matches might return
    unfiltered = vector_store.search_chunks(
        query=irrelevant_query,
        health_id=patient_alice,
        top_k=3,
        min_similarity=0.0
    )

    # With moderate threshold (0.40), irrelevant query (< 0.05) must return 0 results
    filtered = vector_store.search_chunks(
        query=irrelevant_query,
        health_id=patient_alice,
        top_k=3,
        min_similarity=0.40
    )
    assert len(filtered) == 0, f"Expected 0 results for unrelated query above 0.40 threshold, got {len(filtered)}"

    print("-> PASSED: Successfully filtered out low-relevance clinical false positives below 0.40 threshold.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 5: Provenance & Citation Metadata Integrity
    # ------------------------------------------------------------------
    print("\n[TEST 5] Provenance & Citation Metadata Verification...")
    retrieved = vector_store.search_chunks(
        query="blood sugar and glucose",
        health_id=patient_alice,
        top_k=2
    )
    for c in retrieved:
        assert "chunk_id" in c and c["chunk_id"]
        assert "text" in c and len(c["text"]) > 0
        assert "similarity" in c and 0.0 <= c["similarity"] <= 1.0
        assert "document_id" in c and isinstance(c["document_id"], int)
        assert "file_name" in c and c["file_name"].endswith(".pdf")
        assert "page_number" in c and isinstance(c["page_number"], int)
        assert "category" in c and c["category"]

    # Clean up test patients
    vector_store.delete_patient_records(patient_alice)
    vector_store.delete_patient_records(patient_bob)

    print("-> PASSED: All citation fields (document_id, file_name, page_number, similarity) 100% verified.")
    passed_tests += 1

    print("\n==================================================================")
    print(f"VERIFICATION RESULT: ALL {passed_tests}/{total_tests} STAGE 4 TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_stage4_verification()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n-> FAILED ASSERTION: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n-> ERROR DURING VERIFICATION: {e}")
        sys.exit(1)
