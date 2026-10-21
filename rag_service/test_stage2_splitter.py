# rag_service/test_stage2_splitter.py - Stage 2 Verification Test Suite
# Tests clinical text splitting, overlap preservation, and metadata tagging integrity.

import sys
from text_splitter import split_document_pages, split_raw_text, get_chunk_summary

def run_stage2_verification():
    print("==================================================================")
    print("          LIFELINK RAG PIPELINE: STAGE 2 VERIFICATION SUITE       ")
    print("==================================================================")
    passed_tests = 0
    total_tests = 5

    # ------------------------------------------------------------------
    # TEST 1: Multi-Page Clinical Record Splitting & Page Provenance
    # ------------------------------------------------------------------
    print("\n[TEST 1] Multi-Page Clinical Document Splitting...")
    pages = [
        {
            "page_number": 1,
            "text": (
                "CITY CENTRAL HOSPITAL - CLINICAL BIOCHEMISTRY PANEL\n"
                "Patient: Ravi Kant | Health ID: LL-2KZAM | Date: October 2026\n\n"
                "COMPREHENSIVE METABOLIC RESULTS:\n"
                "- Fasting Blood Glucose: 94 mg/dL [Reference: 70 - 99 mg/dL] Normal\n"
                "- Hemoglobin A1c: 5.6 % [Reference: 4.0 - 5.6 %] Normal\n"
                "- Serum Creatinine: 0.92 mg/dL [Reference: 0.70 - 1.30 mg/dL] Normal\n"
                "- Blood Urea Nitrogen (BUN): 14 mg/dL [Reference: 7 - 20 mg/dL] Normal\n"
                "- Serum Potassium: 4.2 mmol/L [Reference: 3.5 - 5.0 mmol/L] Normal\n"
                "- Serum Sodium: 140 mmol/L [Reference: 136 - 145 mmol/L] Normal\n"
                "- Estimated GFR: > 90 mL/min/1.73m2 Normal\n"
                "CLINICAL INTERPRETATION: Renal function and glycemic control remain optimal."
            )
        },
        {
            "page_number": 2,
            "text": (
                "HOSPITAL DISCHARGE INSTRUCTIONS & ACTIVE PHARMACOTHERAPY\n"
                "Discharge Diagnosis: Uncomplicated Acute Bronchitis (Resolved)\n\n"
                "CRITICAL ALLERGY ALERT:\n"
                "- Documented severe anaphylactic reaction to Penicillin and Cephalosporin class antibiotics.\n"
                "- Strictly avoid Beta-Lactam derivatives in future inpatient or outpatient settings.\n\n"
                "CURRENT DISCHARGE MEDICATIONS:\n"
                "1. Azithromycin 250mg PO: 2 tablets on day 1, then 1 tablet daily on days 2-5.\n"
                "2. Fluticasone Propionate 50mcg nasal spray: 1 spray each nostril daily.\n"
                "3. Paracetamol 500mg PO PRN for temperature > 38.0 C (Max 3g/24h).\n\n"
                "FOLLOW-UP APPOINTMENT:\n"
                "Return for routine outpatient review with primary care physician in 2 weeks."
            )
        }
    ]

    chunks = split_document_pages(
        pages=pages,
        document_id=201,
        health_id="LL-2KZAM",
        file_name="hospital_metabolic_panel.pdf",
        category="Lab Report",
        chunk_size=350,
        chunk_overlap=60
    )

    assert len(chunks) >= 2, f"Expected at least 2 chunks, got {len(chunks)}"
    page1_chunks = [c for c in chunks if c["page_number"] == 1]
    page2_chunks = [c for c in chunks if c["page_number"] == 2]

    assert len(page1_chunks) >= 1, "Page 1 chunks missing"
    assert len(page2_chunks) >= 1, "Page 2 chunks missing"

    # Verify metadata fields are 100% present on all chunks
    for c in chunks:
        assert c["document_id"] == 201
        assert c["health_id"] == "LL-2KZAM"
        assert c["file_name"] == "hospital_metabolic_panel.pdf"
        assert c["category"] == "Lab Report"
        assert isinstance(c["chunk_index"], int)
        assert c["char_count"] == len(c["text"])
        assert c["chunk_id"].startswith("doc_201_")

    print(f"-> PASSED: Created {len(chunks)} chunks across 2 pages with 100% metadata integrity.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 2: Chunk Overlap & Boundary Verification
    # ------------------------------------------------------------------
    print("\n[TEST 2] Chunk Overlap & Context Continuity Verification...")
    sample_text = (
        "Patient exhibits baseline normotensive resting blood pressure recorded at 118/76 mmHg. "
        "No reported symptoms of exertional dyspnea, orthopnea, or paroxysmal nocturnal dyspnea. "
        "Resting electrocardiogram demonstrates normal sinus rhythm at 68 beats per minute with normal PR interval. "
        "Serial capillary fasting glucose measurements remain within non-diabetic range over 90 days. "
        "Patient maintains regular moderate cardiovascular physical activity 4 times weekly."
    )

    chunks_overlap = split_raw_text(
        raw_text=sample_text,
        document_id=202,
        health_id="LL-2KZAM",
        file_name="cardiac_review.txt",
        chunk_size=250,
        chunk_overlap=120
    )

    assert len(chunks_overlap) >= 2, "Expected multiple chunks for overlap testing"
    # Verify that every consecutive pair of chunks shares overlapping words
    for i in range(len(chunks_overlap) - 1):
        c1_words = set(w.lower() for w in chunks_overlap[i]["text"].split() if len(w) > 4)
        c2_words = set(w.lower() for w in chunks_overlap[i + 1]["text"].split() if len(w) > 4)
        shared_words = c1_words.intersection(c2_words)
        assert len(shared_words) >= 3, f"Chunks {i+1} and {i+2} should share at least 3 contextual words, found: {shared_words}"

    print(f"-> PASSED: Verified semantic overlap across all {len(chunks_overlap)} consecutive chunks.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 3: Edge Case Handling (Short Notes, Empty Inputs)
    # ------------------------------------------------------------------
    print("\n[TEST 3] Edge Cases: Short Notes & Empty Inputs...")
    short_text = "Blood Group: O Positive. Verified by hospital blood bank."
    short_chunks = split_raw_text(
        raw_text=short_text,
        document_id=203,
        health_id="LL-2KZAM",
        file_name="blood_card.txt",
        chunk_size=500,
        chunk_overlap=50
    )
    assert len(short_chunks) == 1, f"Short text should yield exactly 1 chunk, got {len(short_chunks)}"
    assert short_chunks[0]["text"] == short_text

    empty_chunks = split_raw_text(
        raw_text="   \n\n   ",
        document_id=204,
        health_id="LL-2KZAM",
        file_name="empty.txt"
    )
    assert len(empty_chunks) == 0, "Empty or whitespace text should produce 0 chunks"

    print("-> PASSED: Correctly handled short text (1 intact chunk) and empty input (0 chunks).")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 4: Clinical Numbers & Units Preservation
    # ------------------------------------------------------------------
    print("\n[TEST 4] Clinical Numerical Values & Units Preservation...")
    lab_text = (
        "Hemoglobin: 14.8 g/dL\n"
        "Total Cholesterol: 185 mg/dL\n"
        "Potassium: 4.2 mmol/L\n"
        "Blood Pressure: 120/80 mmHg"
    )
    num_chunks = split_raw_text(
        raw_text=lab_text,
        document_id=205,
        health_id="LL-2KZAM",
        file_name="lab_vitals.txt",
        chunk_size=500
    )
    chunk_body = num_chunks[0]["text"]
    assert "14.8 g/dL" in chunk_body
    assert "185 mg/dL" in chunk_body
    assert "4.2 mmol/L" in chunk_body
    assert "120/80 mmHg" in chunk_body

    print("-> PASSED: Verified clinical decimal numbers, ratios, and units remain intact.")
    passed_tests += 1

    # ------------------------------------------------------------------
    # TEST 5: Chunk Summary Statistics Engine
    # ------------------------------------------------------------------
    print("\n[TEST 5] Chunk Summary Statistics Engine...")
    stats = get_chunk_summary(chunks)
    assert stats["total_chunks"] == len(chunks)
    assert stats["pages_covered"] == 2
    assert stats["min_chunk_size"] > 0
    assert stats["max_chunk_size"] >= stats["min_chunk_size"]
    assert stats["avg_chunk_size"] > 0

    print("-> PASSED: Statistics engine produced valid metrics:")
    print(f"   - Total Chunks: {stats['total_chunks']}")
    print(f"   - Average Chunk Size: {stats['avg_chunk_size']} characters")
    print(f"   - Pages Covered: {stats['pages_covered']}")
    print(f"   - Range: [{stats['min_chunk_size']} - {stats['max_chunk_size']}] characters")
    passed_tests += 1

    print("\n==================================================================")
    print(f"VERIFICATION RESULT: ALL {passed_tests}/{total_tests} TESTS PASSED SUCCESSFULLY (100%)")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_stage2_verification()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n-> FAILED ASSERTION: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n-> ERROR DURING VERIFICATION: {e}")
        sys.exit(1)
