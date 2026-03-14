#!/bin/bash
# Start the React frontend (Vite dev server)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "  DipCheck Frontend (Vite)"
echo "================================"
echo "App: http://localhost:5173"
echo ""

# Install if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npm run dev
