# Agentic RAG-Based Intelligent Document Chatbot

An enterprise-grade, multi-format **Agentic Retrieval-Augmented Generation (RAG)** system powered by **Google Gemini**, **TypeScript/Express**, and **React 19 with Tailwind CSS**.

The system ingests documents across 10+ formats, parses and chunks text with metadata retention (pages, spreadsheet sheets, row ranges, markdown headers), generates dense vector embeddings via Gemini `text-embedding-004`, and performs self-correcting agentic retrieval loops with adaptive query rewriting, relevance grading, grounded answer synthesis, and source citations.

---

## 🌟 Key Features

- **Multi-Format Ingestion Engine**:
  - Supports **PDF**, **DOCX**, **DOC**, **XLSX**, **XLS**, **CSV**, **JSON**, **XML**, **RTF**, **TXT**, and **Markdown (.md)**.
  - Preserves contextual metadata: PDF page numbers, Excel/CSV sheet names and row numbers, and Markdown heading hierarchies.
- **Recursive Character Chunking**:
  - 1,000-character chunk sizing with 200-character overlap for optimal semantic retention.
- **Agentic RAG State Machine Workflow**:
  - **Query Analysis & Disambiguation**: Analyzes user question with conversation history.
  - **Vector Retrieval**: Fast semantic cosine similarity search across user-scoped document embeddings.
  - **Relevance Grading**: Evaluates semantic alignment between retrieved passages and the query.
  - **Adaptive Query Rewriting**: If retrieved context fails to meet relevance thresholds, the agent reformulates search queries (up to 2 iterations) to retrieve better context.
  - **Grounded Answer Synthesis**: Produces grounded responses via `gemini-2.5-flash` strictly backed by retrieved documents.
  - **Precise Source Citations**: Includes document name, page, sheet, row range, and textual excerpts for every claim.
- **Interactive Multi-Turn Chat**:
  - Conversation thread management with sidebar history.
  - Selective document targeting (chat across all documents or pick specific files).
  - Real-time workflow state badges showing each step of the pipeline.
- **Security & Authentication**:
  - JWT token-based authentication with bcrypt-hashed credentials.
  - Pre-seeded instant demo user for instant evaluation.

---

## 👤 Pre-Configured Demo Credentials

For quick evaluation and testing, you can use the 1-click **Instant Demo Login** button or enter:

- **Name**: `Ambadipudi Rupavani`
- **Email**: `ambadipudirupa@gmail.com`
- **Password**: `Password123!`

---

## 🏗️ Repository Architecture

```text
├── README.md                      # Project documentation and setup guide
├── metadata.json                  # Application capabilities and metadata
├── package.json                   # Node.js dependencies & build scripts
├── vite.config.ts                 # Vite bundler configuration
├── tsconfig.json                  # TypeScript compiler settings
├── server.ts                      # Express server entry point & API routes
├── .env.example                   # Environment variable template
├── dependencies/                  # Dependencies and setup scripts for GitHub
│   ├── README.md                  # Detailed dependency & environment guide
│   ├── package.json               # Node.js dependency reference
│   ├── requirements.txt           # Python backend dependencies
│   └── install.sh                 # Unified installation script
├── server/                        # Server-side TypeScript modules
│   ├── types.ts                   # Backend data schemas & types
│   ├── db.ts                      # JSON persistence store
│   ├── documentParsers.ts         # Multi-format parser (PDF, Word, Excel, JSON, etc.)
│   ├── geminiService.ts           # Google GenAI SDK client & vector utilities
│   └── agenticRag.ts              # Agentic RAG state machine & query rewriter
├── src/                           # React 19 Frontend
│   ├── main.tsx                   # Frontend entry point
│   ├── App.tsx                    # Root React component
│   ├── context/                   # React Context (Auth state)
│   ├── components/                # Modular UI components (Chat, Upload, Sources, Modals)
│   └── types.ts                   # Client-side TypeScript types
└── backend/                       # Python FastAPI implementation (optional alternative)
    ├── requirements.txt           # Python dependencies
    └── app/                       # FastAPI application code
```

---

## 🚀 Quickstart Guide

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/agentic-rag-document-chatbot.git
cd agentic-rag-document-chatbot
```

### 2. Configure Environment Variables

Copy the example `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Google Gemini API key:

```env
GEMINI_API_KEY="your-gemini-api-key-here"
```

> **Note**: Obtain a free API key at [Google AI Studio](https://aistudio.google.com/).

### 3. Install Dependencies

You can run the install script located in the `dependencies/` folder:

```bash
chmod +x dependencies/install.sh
./dependencies/install.sh
```

Or install manually via npm:

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

The application will start on **`http://localhost:3000`**.

### 5. Production Build & Start

To build for production:

```bash
npm run build
npm start
```

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Service status and Gemini configuration check |
| `/api/auth/register` | `POST` | Register a new user account |
| `/api/auth/login` | `POST` | Authenticate user and receive JWT bearer token |
| `/api/auth/me` | `GET` | Retrieve current authenticated user profile |
| `/api/documents/upload` | `POST` | Upload and parse one or multiple documents |
| `/api/documents` | `GET` | List all uploaded documents for current user |
| `/api/documents/:id` | `GET` | Retrieve document details and status |
| `/api/documents/:id` | `DELETE` | Delete document and remove all vector chunks |
| `/api/chat` | `POST` | Execute Agentic RAG search and answer generation |
| `/api/conversations` | `GET` | Retrieve conversation threads |
| `/api/conversations` | `POST` | Create a new conversation thread |
| `/api/conversations/:id` | `GET` | Retrieve message history for a conversation |
| `/api/conversations/:id` | `DELETE` | Delete a conversation thread |

---

## 📄 License

This project is licensed under the MIT License.
