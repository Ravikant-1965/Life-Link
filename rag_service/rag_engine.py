# rag_service/rag_engine.py - Stage 5: Grounded Clinical Generation & Citations (Python)
import sys
from pathlib import Path

# Ensure rag_service is in sys.path
_dir = str(Path(__file__).resolve().parent)
if _dir not in sys.path:
    sys.path.insert(0, _dir)

import httpx
import json
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from config import GEMINI_API_KEY

try:
    from tool import get_gemini_tools, execute_tool_call
except ImportError:
    from rag_service.tool import get_gemini_tools, execute_tool_call

CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.8-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest"
]

def is_profile_or_health_query(query: str, retrieved_chunks: Optional[List[Dict[str, Any]]] = None) -> bool:
    if retrieved_chunks and len(retrieved_chunks) > 0:
        return True
    if not query or not isinstance(query, str):
        return False
    q = query.lower().strip()
    keywords = [
        "health", "profile", "record", "medical", "doctor", "hospital", "patient",
        "blood", "allergy", "allergies", "medication", "medicine", "pill", "dose",
        "asthma", "condition", "surgery", "surgeries", "history", "emergency",
        "symptom", "pain", "treatment", "diagnosis", "disease", "illness", "clinical",
        "report", "lab", "test", "prescription", "drug", "care", "vaccine", "rx",
        "allergic", "penicillin", "organ", "donor", "triage", "paramedic", "vital",
        "first responder", "cholesterol", "lipid", "cardiac", "heart", "glucose", "sugar",
        "scan", "mri", "x-ray", "ct", "biopsy", "infection", "fever", "cough"
    ]
    return any(k in q for k in keywords)

def build_clinical_context(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    patient_profile: Optional[Dict[str, Any]] = None
) -> str:
    """
    Constructs an augmented clinical context combining structured profile and retrieved report chunks.
    Only includes structured health profile if query is health or record related.
    """
    sections: List[str] = []

    if patient_profile and is_profile_or_health_query(query, retrieved_chunks):
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

def _build_gemini_payload(
    query: str,
    context: str,
    patient_name: str,
    history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    system_prompt = (
        "You are Life Link AI, an intelligent, empathetic medical assistant and clinical records companion.\n"
        f"You are speaking with {patient_name}.\n\n"
        "Guidelines:\n"
        "1. Answer the user's specific question directly. If they greet you (e.g. 'Hello', 'What can you do?') or ask general health/wellness questions, respond naturally, warmly, and helpfully.\n"
        "2. DO NOT bring up or recite the patient's personal medical records (such as their blood group, allergies, or chronic conditions) unless the user specifically asks about their personal health data, medications, or history, or when evaluating a critical safety contraindication.\n"
        "3. If retrieved medical reports or lab results are available and directly relevant to the query, cite the source file name and page number.\n"
        "4. If something is unknown or not documented in their records, clearly state so without fabricating facts.\n"
        "5. Maintain an objective, professional, and compassionate medical tone. Do not use emojis.\n"
        "6. Medical Disclaimer: ONLY include a brief emergency disclaimer if the user's question or your response specifically discusses clinical diagnoses, medical symptoms, medication advice, or emergency treatment. DO NOT include any medical disclaimer for general inquiries, system/technical questions (such as databases, architecture, or software), weather, time, greetings, or non-medical tool queries.\n"
        "7. STRICT FORMATTING: NEVER enclose words, headings, or titles in double asterisks (**) or single asterisks (*). Do not use markdown bold or italic syntax. Write all section titles, numbers, and disclaimers in clean plain text (e.g. '1. Review Your Clinical Profile:' NEVER '1. **Review Your Clinical Profile:**', and 'Disclaimer: ...' NEVER '*Disclaimer:...*').\n"
        "8. LIVE PROFILE AS SOURCE OF TRUTH: The provided patient clinical profile represents the live, up-to-date state of the user's records. If the user recently edited, deleted, or cleared any records (such as removing allergies, medications, or conditions), the live profile ALWAYS supersedes any past statements in the earlier conversation history. If a condition, allergy, or medication was mentioned earlier in the chat but is no longer present in the clinical profile, consider it deleted/removed and state that it is no longer on file.\n\n"
        f"{context}"
    )

    contents = []
    if history and isinstance(history, list):
        recent_turns = history[-6:]
        for msg in recent_turns:
            role = "user" if msg.get("role") in ["user", "patient"] else "model"
            text = msg.get("text") or msg.get("content") or msg.get("message") or ""
            if text.strip():
                if contents and contents[-1]["role"] == role:
                    contents[-1]["parts"][0]["text"] += f"\n{text.strip()}"
                else:
                    contents.append({"role": role, "parts": [{"text": text.strip()}]})

    if contents and contents[-1]["role"] == "user":
        contents[-1]["parts"][0]["text"] += f"\n{query.strip()}"
    else:
        contents.append({"role": "user", "parts": [{"text": query.strip()}]})

    return {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "tools": get_gemini_tools(),
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800
        }
    }

async def generate_rag_answer(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    patient_profile: Optional[Dict[str, Any]] = None,
    patient_name: str = "Patient",
    history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Synthesizes retrieved chunks, clinical profile, and multi-turn dialog into an LLM response with citations.
    Supports native tool execution if Gemini invokes a registered function.
    """
    context = build_clinical_context(query, retrieved_chunks, patient_profile)
    sources = [
        {
            "chunk_id": c.get("chunk_id"),
            "file_name": c.get("file_name"),
            "page_number": c.get("page_number"),
            "category": c.get("category"),
            "similarity": c.get("similarity"),
            "excerpt": c.get("text")[:180] + "..." if len(c.get("text", "")) > 180 else c.get("text")
        }
        for c in retrieved_chunks
    ]

    if GEMINI_API_KEY:
        payload = _build_gemini_payload(query, context, patient_name, history)
        for model in CANDIDATE_MODELS:
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            cand_content = candidates[0]["content"]
                            parts = cand_content.get("parts", [])

                            # Check if model invoked registered function(s)
                            function_call_parts = [p for p in parts if "functionCall" in p]

                            if function_call_parts:
                                response_parts = []
                                for p in function_call_parts:
                                    fc = p["functionCall"]
                                    func_name = fc.get("name", "tool")
                                    tool_result = execute_tool_call(fc)
                                    resp_obj = {"name": func_name, "response": {"result": str(tool_result)}}
                                    if "id" in fc:
                                        resp_obj["id"] = fc["id"]
                                    response_parts.append({"functionResponse": resp_obj})

                                followup_contents = list(payload.get("contents", []))
                                followup_contents.append({"role": "model", "parts": function_call_parts})
                                followup_contents.append({
                                    "role": "user",
                                    "parts": response_parts
                                })
                                followup_payload = dict(payload)
                                followup_payload["contents"] = followup_contents

                                res2 = await client.post(url, json=followup_payload)
                                if res2.status_code == 200:
                                    data2 = res2.json()
                                    candidates2 = data2.get("candidates", [])
                                    if candidates2 and "content" in candidates2[0]:
                                        parts2 = candidates2[0]["content"].get("parts", [])
                                        if parts2 and "text" in parts2[0]:
                                            return {
                                                "answer": parts2[0]["text"].strip(),
                                                "sources": sources,
                                                "grounded": True,
                                                "engine": f"google-{model}-tools"
                                            }

                            elif parts and "text" in parts[0]:
                                answer = parts[0]["text"].strip()
                                return {
                                    "answer": answer,
                                    "sources": sources,
                                    "grounded": len(retrieved_chunks) > 0,
                                    "engine": f"google-{model}"
                                }
                    else:
                        print(f"[RAG Engine] Model {model} status {res.status_code}: {res.text[:100]}")
            except Exception as api_err:
                print(f"[RAG Engine] Error calling {model}: {api_err}")

    # Local Clinical Synthesis Engine fallback
    return synthesize_local_clinical_response(query, retrieved_chunks, patient_profile, patient_name, sources)

async def stream_rag_answer(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    patient_profile: Optional[Dict[str, Any]] = None,
    patient_name: str = "Patient",
    history: Optional[List[Dict[str, Any]]] = None
) -> AsyncGenerator[str, None]:
    """
    Streams RAG response chunk by chunk as Server-Sent Events (SSE).
    Supports real-time function execution and follow-up streaming.
    Prints tokens to console in real time with flush=True.
    """
    context = build_clinical_context(query, retrieved_chunks, patient_profile)
    sources = [
        {
            "chunk_id": c.get("chunk_id"),
            "file_name": c.get("file_name"),
            "page_number": c.get("page_number"),
            "category": c.get("category"),
            "similarity": c.get("similarity"),
            "excerpt": c.get("text")[:180] + "..." if len(c.get("text", "")) > 180 else c.get("text")
        }
        for c in retrieved_chunks
    ]

    payload = _build_gemini_payload(query, context, patient_name, history)

    if GEMINI_API_KEY:
        for model in CANDIDATE_MODELS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"
                async with httpx.AsyncClient(timeout=35.0) as client:
                    async with client.stream("POST", url, json=payload) as response:
                        if response.status_code == 200:
                            # Send metadata event first
                            metadata = {
                                "type": "metadata",
                                "sources": sources,
                                "engine": f"google-{model}",
                                "grounded": len(retrieved_chunks) > 0
                            }
                            yield f"data: {json.dumps(metadata)}\n\n"

                            function_call_parts = []
                            streamed_text = False

                            async for line in response.aiter_lines():
                                if line.startswith("data: "):
                                    raw = line[6:].strip()
                                    if not raw:
                                        continue
                                    try:
                                        d = json.loads(raw)
                                        candidates = d.get("candidates", [])
                                        if candidates:
                                            content = candidates[0].get("content", {})
                                            parts = content.get("parts", [])
                                            for part in parts:
                                                if "functionCall" in part:
                                                    function_call_parts.append(part)
                                                elif "text" in part:
                                                    txt = part.get("text", "")
                                                    if txt:
                                                        if not streamed_text:
                                                            print(f"\n[Life Link AI Stream ({model})]: ", end="", flush=True)
                                                            streamed_text = True
                                                        print(txt, end="", flush=True)
                                                        yield f"data: {json.dumps({'type': 'token', 'text': txt})}\n\n"
                                    except Exception:
                                        continue

                            # If model called tool(s), execute all of them and stream the follow-up answer
                            if function_call_parts:
                                response_parts = []
                                for p in function_call_parts:
                                    fc = p["functionCall"]
                                    func_name = fc.get("name", "tool")
                                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': func_name, 'args': fc.get('args', {})})}\n\n"

                                    tool_result = execute_tool_call(fc)
                                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': func_name, 'result': str(tool_result)})}\n\n"

                                    resp_obj = {"name": func_name, "response": {"result": str(tool_result)}}
                                    if "id" in fc:
                                        resp_obj["id"] = fc["id"]
                                    response_parts.append({"functionResponse": resp_obj})

                                followup_contents = list(payload.get("contents", []))
                                followup_contents.append({"role": "model", "parts": function_call_parts})
                                followup_contents.append({
                                    "role": "user",
                                    "parts": response_parts
                                })
                                followup_payload = dict(payload)
                                followup_payload["contents"] = followup_contents

                                async with client.stream("POST", url, json=followup_payload) as follow_res:
                                    if follow_res.status_code == 200:
                                        print(f"\n[Life Link AI Tool Followup Stream ({model})]: ", end="", flush=True)
                                        async for f_line in follow_res.aiter_lines():
                                            if f_line.startswith("data: "):
                                                f_raw = f_line[6:].strip()
                                                if not f_raw:
                                                    continue
                                                try:
                                                    f_d = json.loads(f_raw)
                                                    f_cands = f_d.get("candidates", [])
                                                    if f_cands:
                                                        f_parts = f_cands[0].get("content", {}).get("parts", [])
                                                        for f_part in f_parts:
                                                            f_txt = f_part.get("text", "")
                                                            if f_txt:
                                                                if not streamed_text:
                                                                    streamed_text = True
                                                                print(f_txt, end="", flush=True)
                                                                yield f"data: {json.dumps({'type': 'token', 'text': f_txt})}\n\n"
                                                except Exception:
                                                    continue
                                    else:
                                        err_body = await follow_res.aread()
                                        print(f"[RAG Stream Followup Error {follow_res.status_code}]: {err_body.decode('utf-8', errors='ignore')}", flush=True)

                            if streamed_text or function_call_parts:
                                print("\n", flush=True)
                                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                                return
                        else:
                            print(f"[RAG Stream] Model {model} status {response.status_code}", flush=True)
            except Exception as stream_err:
                print(f"[RAG Stream Error {model}]: {stream_err}", flush=True)

    # Fallback to local clinical synthesis if stream failed or no API key
    local_res = synthesize_local_clinical_response(query, retrieved_chunks, patient_profile, patient_name, sources)
    metadata = {
        "type": "metadata",
        "sources": sources,
        "engine": "local-clinical-synthesis",
        "grounded": len(retrieved_chunks) > 0
    }
    yield f"data: {json.dumps(metadata)}\n\n"

    print("\n[Life Link AI Local Fallback Stream]: ", end="", flush=True)
    words = local_res["answer"].split(" ")
    for idx, word in enumerate(words):
        token = word + (" " if idx < len(words) - 1 else "")
        print(token, end="", flush=True)
        yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
        await asyncio.sleep(0.015)

    print("\n", flush=True)
    yield f"data: {json.dumps({'type': 'done'})}\n\n"

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
    lines: List[str] = []

    # Check for allergy contraindications if profile has allergies
    documented_allergies = (profile or {}).get("allergies", "")
    if documented_allergies and chunks:
        allergy_keywords = [a.strip().lower() for a in documented_allergies.split(",") if a.strip()]
        for c in chunks:
            chunk_text = c.get("text", "").lower()
            for ak in allergy_keywords:
                if len(ak) > 3 and ak in chunk_text:
                    lines.append(f"CLINICAL CAUTION: Documented allergy to '{ak.title()}' was detected in reference to records.")
                    break

    # Highlight retrieved document findings if found
    if chunks:
        lines.append(f"Hello {name}, based on your encrypted medical records, here are the findings relevant to \"{query}\":")
        for idx, chunk in enumerate(chunks[:3], 1):
            src = chunk.get("file_name", "Medical Document")
            pg = chunk.get("page_number", 1)
            cat = chunk.get("category", "General")
            txt = chunk.get("text", "").strip()
            sim = int(chunk.get("similarity", 0.0) * 100)
            lines.append(f"\n• Source {idx}: {src} (Page {pg}, Category: {cat}, Relevance: {sim}%):\n  {txt}")

        lines.append(
            "\nClinical Guidance: Please verify any new symptoms or abnormal lab markers with your attending physician. "
            "Verified emergency teams can access these source documents directly during clinical care."
        )
    else:
        # If user asked about medical records or profile, summarize records
        if is_profile_or_health_query(query):
            blood = (profile or {}).get("blood_group", "Not recorded")
            allergies = (profile or {}).get("allergies", "None documented")
            meds = (profile or {}).get("current_medications", "None recorded")
            conditions = (profile or {}).get("chronic_conditions", "None documented")

            lines.append(f"Hello {name}, I reviewed your encrypted medical profile for: \"{query}\".")
            lines.append(f"\n• Recorded Blood Group: {blood}")
            lines.append(f"• Critical Allergies: {allergies}")
            lines.append(f"• Active Medications: {meds}")
            lines.append(f"• Chronic Conditions: {conditions}")
            lines.append(
                "\nNote: No specific lab document chunks matched this query in your document store. "
                "You can upload your official PDF lab reports or discharge summaries in the Documents tab for deep AI search."
            )
        else:
            lines.append(
                f"Hello {name}. I am Life-Link AI, your personal clinical companion. "
                "I can assist you with health questions, look up real-time weather and time, "
                "and analyze your medical documents whenever you upload them."
            )

    return {
        "answer": "\n".join(lines),
        "sources": sources,
        "grounded": len(chunks) > 0,
        "engine": "local-clinical-synthesis"
    }
