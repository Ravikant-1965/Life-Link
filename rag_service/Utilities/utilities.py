# rag_service/Utilities/utilities.py

def log(message: str):
    """Prints tool logs cleanly to the console."""
    print(f"[TOOL LOG] {message}", flush=True)
