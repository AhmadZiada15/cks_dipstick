#!/bin/bash
# Start the FastAPI backend
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "================================"
echo "  DipCheck Backend (FastAPI)"
echo "================================"
echo "Docs: http://localhost:8000/docs"
echo "Demo: http://localhost:8000/api/demo"
echo ""

# Create venv if needed
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install / upgrade dependencies — show output so failures are visible
echo "Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
  echo ""
  echo "ERROR: pip install failed. Check errors above."
  exit 1
fi

echo ""
echo "Starting uvicorn on http://0.0.0.0:8000 ..."
echo ""

uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
