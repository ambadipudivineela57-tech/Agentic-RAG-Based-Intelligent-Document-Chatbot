#!/usr/bin/env bash
# Installation automation script for Agentic RAG Document Chatbot
set -e

echo "=== Setting up Agentic RAG Document Chatbot Dependencies ==="

# 1. Check Node.js and install npm dependencies
if command -v npm >/dev/null 2>&1; then
    echo "[1/2] Installing Node.js & UI packages..."
    npm install
    echo "✓ Node.js dependencies installed successfully."
else
    echo "⚠️ Warning: npm is not installed or not in PATH."
fi

# 2. Check Python and offer pip install if requested
if command -v python3 >/dev/null 2>&1; then
    echo "[2/2] Python3 detected ($(python3 --version))."
    if [ -f "backend/requirements.txt" ]; then
        echo "Tip: To install Python FastAPI backend requirements, execute:"
        echo "  python3 -m venv backend/venv && source backend/venv/bin/activate && pip install -r backend/requirements.txt"
    fi
fi

echo "=== All core dependencies are configured! ==="
echo "Run 'npm run dev' to start the application."
