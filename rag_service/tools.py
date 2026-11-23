# rag_service/tool.py - Function Calling & Tool Registry for Life Link AI
import sys
from pathlib import Path

# Ensure rag_service directory is in sys.path so relative & local imports work everywhere
_dir = str(Path(__file__).resolve().parent)
if _dir not in sys.path:
    sys.path.insert(0, _dir)

from datetime import datetime
import requests
import json

try:
    from Utilities.utilities import log
except ImportError:
    from rag_service.Utilities.utilities import log

try:
    from rag import search
except ImportError:
    from rag_service.rag import search

# ==============================================================================
# 1. ACTUAL PYTHON FUNCTION DEFINITIONS
# (Runs locally on our machine when called by the LLM)
# ==============================================================================

def get_current_time():
    """Returns the current formatted date and time."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log(f"⏰ get_current_time called -> {now_str}")
    return now_str

def get_city_weather(city: str):
    """Fetches real-time weather for any city via wttr.in."""
    try:
        url = f"https://wttr.in/{city}?format=3"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        weather = response.text.strip()
        log(f"🌤️ get_city_weather({city}) -> {weather}")
        return weather
    except Exception as e:
        log(f"Weather fetch failed for {city}: {e}")
        return f"Unable to fetch weather for {city} right now."

def search_knowledge_base(query: str):
    """
    Searches the LifeLink medical knowledge base & uploaded records.
    Returns the most relevant passages with their source document.
    """
    results = search(query, top_k=3)

    log(f"📚 Knowledge base search: {query}")
    for r in results:
        log(f"   Score: {r['score']:.2f} | Source: {r['source']} #{r['chunk_id']}")

    if not results:
        return "No specific document excerpts found in the knowledge base matching this query."

    blocks = []
    for r in results:
        source_name = r['source']
        chunk_id = r['chunk_id']
        chunk_text = r['text'].strip()

        header = f"[{source_name} #{chunk_id} - Match: {int(r['score'] * 100)}%]"
        block = f"{header}\n{chunk_text}"
        blocks.append(block)

    return "\n\n".join(blocks)

def check_drug_interaction(drug_a: str, drug_b: str):
    """
    Checks common clinical contraindications between two medications.
    """
    log(f"💊 check_drug_interaction called for '{drug_a}' and '{drug_b}'")
    pair = {drug_a.lower().strip(), drug_b.lower().strip()}

    known_interactions = [
        ({"aspirin", "warfarin"}, "HIGH RISK: Concurrent use significantly increases risk of major gastrointestinal and internal bleeding."),
        ({"metformin", "contrast dye"}, "HIGH RISK: May cause lactic acidosis; metformin must be temporarily withheld prior to iodinated contrast procedures."),
        ({"ibuprofen", "lisinopril"}, "MODERATE RISK: NSAIDs can diminish antihypertensive effect of ACE inhibitors and increase nephrotoxicity."),
        ({"paracetamol", "alcohol"}, "MODERATE RISK: Chronic concurrent use increases hepatotoxicity risk."),
        ({"salbutamol", "propranolol"}, "HIGH CONTRAINDICATION: Non-selective beta-blockers cause severe bronchospasm in asthmatic patients taking beta-agonists.")
    ]

    for known_pair, advisory in known_interactions:
        if known_pair.issubset(pair) or any(k in drug_a.lower() for k in known_pair) and any(k in drug_b.lower() for k in known_pair):
            return f"CLINICAL INTERACTION WARNING ({drug_a.title()} + {drug_b.title()}): {advisory}"

    return f"No severe documented interaction found between {drug_a.title()} and {drug_b.title()} in rapid database. Always confirm with the attending pharmacist or prescribing physician."

def calculate_bmi(weight_kg: float, height_cm: float):
    """Calculates BMI and returns health category."""
    try:
        height_m = float(height_cm) / 100.0
        weight = float(weight_kg)
        if height_m <= 0 or weight <= 0:
            return "Invalid height or weight values provided."
        bmi = round(weight / (height_m ** 2), 1)
        if bmi < 18.5:
            cat = "Underweight"
        elif bmi <= 24.9:
            cat = "Normal weight"
        elif bmi <= 29.9:
            cat = "Overweight"
        else:
            cat = "Obesity range"
        log(f"⚖️ calculate_bmi({weight}kg, {height_cm}cm) -> {bmi} ({cat})")
        return f"BMI: {bmi} ({cat}). Weight: {weight}kg, Height: {height_cm}cm."
    except Exception as e:
        return f"Error calculating BMI: {e}"


# ==============================================================================
# 2. TOOLS DEFINITION (JSON Schema for the LLM)
# ==============================================================================
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "Get the current real-world date and time.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_city_weather",
            "description": "Get current live weather condition and temperature for any city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city name (e.g. 'Mumbai', 'London', 'New York')"
                    }
                },
                "required": ["city"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Searches the patient's encrypted medical records, uploaded lab PDF reports, and clinical documents. Returns relevant excerpts with citations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The specific search query to find in medical records."
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_drug_interaction",
            "description": "Checks known clinical drug-drug interactions, contraindications, and safety warnings between two medications.",
            "parameters": {
                "type": "object",
                "properties": {
                    "drug_a": {
                        "type": "string",
                        "description": "Name of the first medication (e.g. Aspirin)"
                    },
                    "drug_b": {
                        "type": "string",
                        "description": "Name of the second medication (e.g. Warfarin)"
                    }
                },
                "required": ["drug_a", "drug_b"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_bmi",
            "description": "Calculates the patient's Body Mass Index (BMI) and health category based on weight (kg) and height (cm).",
            "parameters": {
                "type": "object",
                "properties": {
                    "weight_kg": {
                        "type": "number",
                        "description": "Patient's body weight in kilograms"
                    },
                    "height_cm": {
                        "type": "number",
                        "description": "Patient's height in centimeters"
                    }
                },
                "required": ["weight_kg", "height_cm"]
            }
        }
    }
]


# ==============================================================================
# 3. FUNCTION DISPATCH MAP
# ==============================================================================
FUNCTION_NAME_TO_FUNCTION_MAP = {
    "get_current_time": get_current_time,
    "get_city_weather": get_city_weather,
    "search_knowledge_base": search_knowledge_base,
    "check_drug_interaction": check_drug_interaction,
    "calculate_bmi": calculate_bmi
}


# ==============================================================================
# 4. GEMINI TOOLS SCHEMA ADAPTER
# (Transforms standard OpenAI function schemas into Gemini function_declarations)
# ==============================================================================
def get_gemini_tools():
    """Returns tools in Google Gemini function_declarations format."""
    declarations = []
    for item in TOOLS:
        fn = item.get("function", {})
        params = fn.get("parameters", {})
        raw_props = params.get("properties", {})
        gemini_props = {}
        for p_name, p_val in raw_props.items():
            prop_type = p_val.get("type", "string").upper()
            if prop_type == "NUMBER":
                prop_type = "NUMBER"
            elif prop_type == "INTEGER":
                prop_type = "INTEGER"
            elif prop_type == "BOOLEAN":
                prop_type = "BOOLEAN"
            else:
                prop_type = "STRING"
            gemini_props[p_name] = {
                "type": prop_type,
                "description": p_val.get("description", "")
            }

        declarations.append({
            "name": fn.get("name"),
            "description": fn.get("description"),
            "parameters": {
                "type": "OBJECT",
                "properties": gemini_props,
                "required": params.get("required", [])
            }
        })
    return [{"function_declarations": declarations}]


# ==============================================================================
# 5. TOOL EXECUTION RUNNER
# ==============================================================================
def execute_tool_call(tool_call):
    """
    Executes a tool call requested by the LLM.
    Supports:
      - OpenAI tool_call object with .function.name & .function.arguments
      - Gemini dictionary with {'name': '...', 'args': {...}}
    """
    func_name = ""
    func_args = {}

    try:
        # Check if Gemini dictionary format
        if isinstance(tool_call, dict):
            func_name = tool_call.get("name") or tool_call.get("function", {}).get("name")
            raw_args = tool_call.get("args") or tool_call.get("arguments") or {}
            if isinstance(raw_args, str):
                func_args = json.loads(raw_args or "{}")
            elif isinstance(raw_args, dict):
                func_args = raw_args
        else:
            # OpenAI object format
            func_name = tool_call.function.name
            raw_args = tool_call.function.arguments or "{}"
            if isinstance(raw_args, str):
                func_args = json.loads(raw_args or "{}")
            elif isinstance(raw_args, dict):
                func_args = raw_args

        log(f"Executing '{func_name}' with arguments: {func_args}")

        if func_name not in FUNCTION_NAME_TO_FUNCTION_MAP:
            return f"Error: Tool '{func_name}' is not registered."

        fn = FUNCTION_NAME_TO_FUNCTION_MAP[func_name]
        result = fn(**func_args)

    except Exception as e:
        result = f"Error while running {func_name} : {e}"

    log(f"Tool: '{func_name}' Execution Result: '{result}'")
    return str(result)
