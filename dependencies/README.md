# Project Dependencies Overview

This directory houses all dependency specifications, lockfiles, and installation automation for running the **Agentic RAG-Based Intelligent Document Chatbot** in local environments, Docker containers, or continuous integration (CI) workflows on GitHub.

---

## 📦 Dependency Manifests

1. **`package.json` (Node.js / Full-Stack Stack)**:
   - Primary full-stack runtime (Express, Vite, React 19, Tailwind CSS v4, Google GenAI SDK, PDF/Word/Excel parsers, JWT, bcrypt).
   - Located at repository root (`/package.json`) and mirrored here in `/dependencies/package.json` for standalone reference.

2. **`requirements.txt` (Python Stack)**:
   - Python dependencies for the FastAPI, LangChain, LangGraph, and ChromaDB backend service.
   - Located here in `/dependencies/requirements.txt` and `/backend/requirements.txt`.

3. **`install.sh`**:
   - Automated setup script that detects installed runtimes (Node.js, npm, Python) and installs project requirements.

---

## 🚀 Installation Instructions

### Option A: Standard Full-Stack Setup (Recommended)

Requires **Node.js 18+** and **npm** / **bun**:

```bash
# From repository root
npm install
```

### Option B: Python Virtual Environment Setup (FastAPI Backend)

If developing or running the Python FastAPI microservice:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r dependencies/requirements.txt
```

### Option C: Automated Setup Script

```bash
chmod +x dependencies/install.sh
./dependencies/install.sh
```

---

## 🔑 Required Environment Variables

Set the following in your `.env` file at the repository root:

```env
# Google Gemini API key (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# JWT Signing Secret (Optional, has secure fallback)
JWT_SECRET=your_jwt_secret_key
```
