#!/usr/bin/env bash
# start_rag_service.sh - Launches the LifeLink Python RAG microservice on port 8000
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating venv..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt python-multipart
fi

echo "Starting LifeLink Python RAG Microservice on http://127.0.0.1:8000..."
exec ./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
