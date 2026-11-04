#!/usr/bin/env bash
# ==============================================================================
# LifeLink - All-in-One Startup Script
# Boots Python RAG Service (8000), Node.js Backend (3001), and Vite Frontend (5173)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "          🏥 Starting LifeLink Health Platform            "
echo "=========================================================="

# 1. Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [ "$NODE_VERSION" = "none" ]; then
    echo "❌ Error: Node.js is not installed. Please install Node.js >= 22.13.0."
    exit 1
fi
echo "✓ Node.js version: $NODE_VERSION"

# 2. Check Python version
PYTHON_VERSION=$(python3 --version 2>/dev/null || echo "none")
if [ "$PYTHON_VERSION" = "none" ]; then
    echo "❌ Error: Python 3 is not installed."
    exit 1
fi
echo "✓ Python version: $PYTHON_VERSION"

# Setup cleanup on exit / Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Shutting down LifeLink services..."
    if [ -n "$PID_RAG" ] && kill -0 "$PID_RAG" 2>/dev/null; then
        kill "$PID_RAG" 2>/dev/null
    fi
    if [ -n "$PID_BACKEND" ] && kill -0 "$PID_BACKEND" 2>/dev/null; then
        kill "$PID_BACKEND" 2>/dev/null
    fi
    if [ -n "$PID_FRONTEND" ] && kill -0 "$PID_FRONTEND" 2>/dev/null; then
        kill "$PID_FRONTEND" 2>/dev/null
    fi
    wait 2>/dev/null
    echo "✓ All services stopped safely."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 3. Start Python RAG Service (Port 8000)
echo ""
echo "🚀 [1/3] Starting Python RAG Microservice (port 8000)..."
cd "$PROJECT_ROOT/rag_service"
if [ ! -d "venv" ]; then
    echo "Creating Python virtualenv in rag_service/venv..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt python-multipart
fi
./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 &
PID_RAG=$!
cd "$PROJECT_ROOT"

# 4. Start Node.js Backend (Port 3001)
echo ""
echo "🚀 [2/3] Starting Express & SQLite Backend (port 3001)..."
cd "$PROJECT_ROOT/backend"
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi
node server.js &
PID_BACKEND=$!
cd "$PROJECT_ROOT"

# 5. Start Vite Frontend (Port 5173)
echo ""
echo "🚀 [3/3] Starting Vite React Frontend (port 5173)..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run dev -- --host &
PID_FRONTEND=$!
cd "$PROJECT_ROOT"

echo ""
echo "=========================================================="
echo "✅ All LifeLink services are starting up!"
echo "   - Frontend UI:       http://localhost:5173"
echo "   - Backend API:       http://localhost:3001"
echo "   - Python RAG Engine: http://127.0.0.1:8000"
echo "=========================================================="
echo "Press Ctrl + C at any time to stop all services."
echo ""

# Keep running and wait for background processes
wait

