#!/bin/bash
# Start the FastAPI backend
# Usage: ./start.sh [--mock]
#   --mock  Skip LLM calls (template explanations only)

set -e

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

# Install dependencies
pip install -q -r requirements.txt

# Run
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
