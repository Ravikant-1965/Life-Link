# rag_service/rag_engine.py - Stage 5: Grounded Clinical Generation & Citations (Python)
import httpx
from typing import List, Dict, Any, Optional
from config import GEMINI_API_KEY

def build_clinical_context(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    patient_profile: Optional[Dict[str, Any]] = None
) -> str:
    """
    Constructs an augmented clinical context combining structured profile and retrieved report chunks.
    """
    sections: List[str] = []

    if patient_profile:
        profile_lines = ["--- PATIENT CLINICAL PROFILE ---"]
        if patient_profile.get("blood_group"):
            profile_lines.append(f"Blood Group: {patient_profile['blood_group']}")
        if patient_profile.get("allergies"):
            profile_lines.append(f"Documented Allergies: {patient_profile['allergies']}")
        if patient_profile.get("current_medications"):
            profile_lines.append(f"Active Medications: {patient_profile['current_medications']}")
        if patient_profile.get("chronic_conditions"):
            profile_lines.append(f"Chronic Conditions: {patient_profile['chronic_conditions']}")
        if patient_profile.get("previous_surgeries"):
            profile_lines.append(f"Previous Surgeries: {patient_profile['previous_surgeries']}")
        sections.append("\n".join(profile_lines))

    if retrieved_chunks:
        doc_lines = ["--- RETRIEVED MEDICAL REPORT EXCERPTS (CHROMA VECTOR SEARCH) ---"]
        for idx, chunk in enumerate(retrieved_chunks, 1):
            source = chunk.get("file_name", "Medical Record")
            page = chunk.get("page_number", 1)
            sim = chunk.get("similarity", 0.0)
            text = chunk.get("text", "").strip()
            doc_lines.append(f"[Source {idx}: {source} (Page {page}, Match: {int(sim * 100)}%)]\n{text}")
        sections.append("\n\n".join(doc_lines))
    else:
        sections.append("--- NO SPECIFIC LAB REPORT EXCERPTS FOUND IN DATABASE ---")

    return "\n\n".join(sections)

async def generate_rag_answer(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    patient_profile: Optional[Dict[str, Any]] = None,
    patient_name: str = "Patient"
) -> Dict[str, Any]:
    """
    Synthesizes retrieved chunks and profile into a clinical response with strict citations.
    """
    context = build_clinical_context(query, retrieved_chunks, patient_profile)
    sources = [
        {
            "file_name": c.get("file_name"),
            "page_number": c.get("page_number"),
            "category": c.get("category"),
            "similarity": c.get("similarity"),
            "excerpt": c.get("text")[:180] + "..." if len(c.get("text", "")) > 180 else c.get("text")
        }
        for c in retrieved_chunks
    ]

    # If Gemini API key is available, call Gemini free API
    if GEMINI_API_KEY:
        try:
            prompt = (
                f"You are Life-Link Clinical Assistant, an intelligent medical records assistant.\n"
                f"Answer the patient's question based strictly on the provided medical records and profile.\n"
                f"Ground your answer only in the facts below. If information is not documented, clearly state so.\n"
                f"Always cite the source document name and page number when quoting findings.\n\n"
                f"{context}\n\n"
                f"Patient Question: {query}\n\n"
                f"Assistant Answer:"
            )

            async with httpx.AsyncClient(timeout=25.0) as client:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600}
                }
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    answer = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {
                        "answer": answer.strip(),
                        "sources": sources,
                        "grounded": True,
                        "engine": "gemini-1.5-flash"
                    }
        except Exception as api_err:
            print(f"[RAG Engine] Gemini API call error: {api_err}, falling back to local clinical synthesis.")

    # Local Clinical Synthesis Engine (100% Free, Zero API Key Required)
    return synthesize_local_clinical_response(query, retrieved_chunks, patient_profile, patient_name, sources)

def synthesize_local_clinical_response(
    query: str,
    chunks: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]],
    name: str,
    sources: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Deterministic clinical synthesis using retrieved vectors and structured health records.
    """
    q = query.lower()
    lines: List[str] = []

    # Highlight retrieved document findings if found
    if chunks:
        lines.append(f"Hello **{name}**, I retrieved relevant medical records from your encrypted document store:")
        for idx, chunk in enumerate(chunks[:3], 1):
            src = chunk.get("file_name", "Medical Document")
            pg = chunk.get("page_number", 1)
            txt = chunk.get("text", "").strip()
            lines.append(f"\n• **From `{src}` (Page {pg})**:\n  {txt}")

        lines.append(
            "\n**Clinical Guidance**: Please verify any new symptoms or abnormal lab markers with your attending physician. "
            "Verified emergency teams can access these source documents directly during clinical care."
        )
    else:
        # Fall back to profile records if no vector match found
        blood = (profile or {}).get("blood_group", "Not recorded")
        allergies = (profile or {}).get("allergies", "None documented")
        meds = (profile or {}).get("current_medications", "None recorded")

        lines.append(f"Hello **{name}**, I reviewed your encrypted medical profile for: *\"{query}\"*.")
        lines.append(f"\n• **Recorded Blood Group**: {blood}")
        lines.append(f"• **Critical Allergies**: {allergies}")
        lines.append(f"• **Active Medications**: {meds}")
        lines.append(
            "\n*Note*: No specific lab document chunks matched this query. "
            "You can upload your official PDF lab reports or discharge summaries in the Documents tab for deep AI search."
        )

    return {
        "answer": "\n".join(lines),
        "sources": sources,
        "grounded": len(chunks) > 0,
        "engine": "local-clinical-synthesis"
    }
