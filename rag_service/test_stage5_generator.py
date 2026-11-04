# rag_service/test_stage5_generator.py - Stage 5 Verification Test Suite
# Tests augmented context construction, citation binding, local clinical synthesis, and profile fallback.

import sys
import asyncio
from vector_store import vector_store
from rag_engine import (
    build_clinical_context,
    generate_rag_answer,
    synthesize_local_clinical_response
)

def run_stage5_verification():
    print("==================================================================")
    print("      LIFELINK RAG PIPELINE: STAGE 5 GENERATOR VERIFICATION       ")
    print("==================================================================")
    passed_tests = 0
    total_tests = 5

    test_health_id = "LL-STAGE5-VERIFY"

    # ------------------------------------------------------------------
    # TEST 1: Clinical Context Builder Unit Test
    # ------------------------------------------------------------------
    print("\n[TEST 1] Clinical Context Builder & Prompt Formatting...")
    mock_profile = {
        "blood_group": "O Positive",
        "allergies": "Penicillin, Cephalosporins",
        "current_medications": "Metformin 500mg, Atorvastatin 20mg",
        "chronic_conditions": "Type 2 Diabetes"
    }
    mock_chunks = [
        {
            "chunk_id": "chunk_001",
            "text": "LIPID PANEL: Total Cholesterol 182 mg/dL. LDL 95 mg/dL. HDL 54 mg/dL.",
            "file_name": "lipid_test.pdf",
            "page_number": 1,
            "similarity": 0.85
        }
    ]

    context = build_clinical_context(
        query="What was my cholesterol level?",
        retrieved_chunks=mock_chunks,
        patient_profile=mock_profile
    )

    assert "--- PATIENT CLINICAL PROFILE ---" in context
    assert "Blood Group: O Positive" in context
    assert "Penicillin, Cephalosporins" in context
    assert "lipid_test.pdf (Page 1, Match: 85%)" in context
    assert "Total Cholesterol 182 mg/dL" in context

    print("-> PASSED: Context builder successfully assembled profile and vector chunk provenance.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 2: Deterministic Clinical Synthesis with Source Citations
    # ------------------------------------------------------------------
    print("\n[TEST 2] Local Clinical Synthesis & Citation Binding...")
    synthesis_result = synthesize_local_clinical_response(
        query="What is my cholesterol result?",
        chunks=mock_chunks,
        profile=mock_profile,
        name="Ravi Kant",
        sources=[{
            "chunk_id": "chunk_001",
            "file_name": "lipid_test.pdf",
            "page_number": 1,
            "category": "Lab Report",
            "similarity": 0.85,
            "excerpt": mock_chunks[0]["text"]
        }]
    )

    assert synthesis_result["grounded"] is True, "Result should be marked grounded"
    assert synthesis_result["engine"] == "local-clinical-synthesis"
    answer_text = synthesis_result["answer"]
    assert "Ravi Kant" in answer_text, "Answer should include personalized greeting"
    assert "lipid_test.pdf" in answer_text, "Answer must cite source file name"
    assert "Page 1" in answer_text, "Answer must cite page number"
    assert len(synthesis_result["sources"]) == 1, "Sources list must be populated"

    print("-> PASSED: Grounded clinical synthesis accurately produced citations and personalized answer.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 3: Profile Fallback (Zero Chunks / Off-Topic Query)
    # ------------------------------------------------------------------
    print("\n[TEST 3] Profile Fallback for Unmatched Queries...")
    fallback_result = synthesize_local_clinical_response(
        query="What is the treatment for yellow fever?",
        chunks=[],  # No matching document chunks
        profile=mock_profile,
        name="Ravi Kant",
        sources=[]
    )

    assert fallback_result["grounded"] is False, "Unmatched query should be marked ungrounded"
    fallback_text = fallback_result["answer"]
    assert "No specific lab document chunks matched this query" in fallback_text
    assert "O Positive" in fallback_text
    assert "Penicillin" in fallback_text
    assert len(fallback_result["sources"]) == 0

    print("-> PASSED: Correctly fell back to patient profile baseline when no vector chunks matched.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 4: Clinical Allergy & Contraindication Caution Alert
    # ------------------------------------------------------------------
    print("\n[TEST 4] Clinical Allergy Caution Detection...")
    allergy_chunks = [
        {
            "chunk_id": "rx_001",
            "text": "DISCHARGE PRESCRIPTION: Amoxicillin and Penicillin V potassium 500mg PO QID.",
            "file_name": "discharge_rx.pdf",
            "page_number": 2,
            "similarity": 0.90
        }
    ]
    caution_result = synthesize_local_clinical_response(
        query="Can I take Penicillin for my throat infection?",
        chunks=allergy_chunks,
        profile=mock_profile,
        name="Ravi Kant",
        sources=[]
    )

    caution_text = caution_result["answer"]
    assert "CLINICAL CAUTION" in caution_text or "Penicillin" in caution_text
    assert "Documented allergy" in caution_text

    print("-> PASSED: Safety engine detected allergy match against retrieved clinical records.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 5: End-to-End Chat Flow (Index -> Retrieve -> Generate)
    # ------------------------------------------------------------------
    print("\n[TEST 5] End-to-End Async RAG Pipeline Flow...")
    # Pre-clean
    vector_store.delete_patient_records(test_health_id)

    # Ingest test report chunk
    test_chunk = [
        {
            "chunk_id": f"doc_501_p1_c1_{test_health_id}",
            "text": "BIOCHEMISTRY REPORT: Fasting Glucose 96 mg/dL [Normal]. HbA1c 5.4% [Normal]. Serum Potassium 4.1 mmol/L.",
            "document_id": 501,
            "health_id": test_health_id,
            "file_name": "annual_biochemistry.pdf",
            "category": "Lab Report",
            "page_number": 1,
            "chunk_index": 1,
            "char_count": 105
        }
    ]
    vector_store.index_chunks(test_chunk)

    # Retrieve matching chunks
    retrieved = vector_store.search_chunks(
        query="What is my fasting glucose reading?",
        health_id=test_health_id,
        top_k=2
    )
    assert len(retrieved) > 0, "Retrieval should return indexed biochemistry chunk"

    # Generate answer via async engine
    async def run_chat():
        return await generate_rag_answer(
            query="What is my fasting glucose reading?",
            retrieved_chunks=retrieved,
            patient_profile=mock_profile,
            patient_name="Ravi Kant"
        )

    e2e_response = asyncio.run(run_chat())
    assert e2e_response["grounded"] is True
    assert len(e2e_response["sources"]) > 0
    assert "annual_biochemistry.pdf" in e2e_response["sources"][0]["file_name"]
    assert e2e_response["sources"][0]["page_number"] == 1

    # Cleanup test data
    vector_store.delete_patient_records(test_health_id)

    print(f"-> PASSED: Full RAG pipeline flow successfully completed (Engine: {e2e_response['engine']}).")
    passed_tests += 1

    print("\n==================================================================")
    print(f"VERIFICATION RESULT: ALL {passed_tests}/{total_tests} STAGE 5 TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_stage5_verification()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n-> FAILED ASSERTION: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n-> ERROR DURING VERIFICATION: {e}")
        sys.exit(1)
