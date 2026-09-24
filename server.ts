import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { dbStore } from './server/db';
import { DocumentParser } from './server/documentParsers';
import { GeminiService, cosineSimilarity, generateFastVector } from './server/geminiService';
import { runAgenticRAG } from './server/agenticRag';
import { DbUser, DbDocument, DbChunk } from './server/types';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rag-super-secret-key-2025';

// Server Event Log Ring Buffer (Last 100 events)
interface ServerLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  type: 'HTTP' | 'RAG_PIPELINE' | 'VECTOR_SEARCH' | 'DB_OPERATION' | 'SYSTEM';
  details?: string;
}

const serverLogs: ServerLogEntry[] = [
  {
    id: 'init_sys_1',
    timestamp: new Date().toISOString(),
    method: 'STARTUP',
    path: '/api/*',
    statusCode: 200,
    durationMs: 0,
    type: 'SYSTEM',
    details: 'Agentic RAG Intelligent Document System initialized with SQLite & Gemini 2.5 Flash',
  },
];

function addServerLog(entry: ServerLogEntry) {
  serverLogs.unshift(entry);
  if (serverLogs.length > 100) serverLogs.pop();
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Live request tracing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api') && !req.path.endsWith('/backend/logs')) {
      const type = req.path.includes('/chat')
        ? 'RAG_PIPELINE'
        : req.path.includes('/vector')
        ? 'VECTOR_SEARCH'
        : req.path.includes('/database')
        ? 'DB_OPERATION'
        : 'HTTP';

      addServerLog({
        id: 'log_' + Math.random().toString(36).slice(2, 9),
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        type,
      });
    }
  });
  next();
});

// Multer memory storage for multi-file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Authentication middleware
interface AuthRequest extends Request {
  user?: DbUser;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    const user = dbStore.getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ detail: 'User not found.' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Agentic RAG-Based Intelligent Document Chatbot',
    version: '1.0.0',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ detail: 'Name, email, and password are required.' });
  }

  if (dbStore.getUserByEmail(email)) {
    return res.status(400).json({ detail: 'An account with this email already exists.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashed = bcrypt.hashSync(password, salt);
  const newUser: DbUser = {
    id: 'user_' + crypto.randomBytes(8).toString('hex'),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    hashed_password: hashed,
    created_at: new Date().toISOString(),
  };

  dbStore.addUser(newUser);
  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    created_at: newUser.created_at,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required.' });
  }

  const user = dbStore.getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.hashed_password)) {
    return res.status(401).json({ detail: 'Incorrect email or password.' });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ access_token: token, token_type: 'bearer' });
});

app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at,
  });
});

// -------------------------------------------------------------
// Document Routes
// -------------------------------------------------------------
app.post('/api/documents/upload', authMiddleware, upload.array('files'), async (req: AuthRequest, res) => {
  const user = req.user!;
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ detail: 'No files provided for upload.' });
  }

  const results = [];

  for (const file of files) {
    const originalName = file.originalname;
    const ext = originalName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    try {
      // Parse file into text chunks based on format
      const { chunks } = await DocumentParser.parseFile(file.buffer, originalName, ext);

      const docId = 'doc_' + crypto.randomBytes(8).toString('hex');
      const newDoc: DbDocument = {
        id: docId,
        user_id: user.id,
        filename: `${user.id}_${docId}_${originalName}`,
        original_filename: originalName,
        file_type: ext,
        file_size: file.size,
        file_hash: hash,
        upload_time: new Date().toISOString(),
        status: 'COMPLETED',
        chunk_count: chunks.length,
        error_message: null,
      };

      dbStore.addDocument(newDoc);

      // Generate embeddings and store vectors
      const chunkEntities: DbChunk[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const emb = await GeminiService.getEmbedding(c.content);
        chunkEntities.push({
          id: `${docId}_chunk_${i}`,
          document_id: docId,
          user_id: user.id,
          chunk_index: i,
          content: c.content,
          embedding: emb,
          metadata: {
            filename: originalName,
            page: c.metadata.page,
            sheet: c.metadata.sheet,
            section: c.metadata.section,
            row_range: c.metadata.row_range,
            chunk_id: i,
            document_id: docId,
            user_id: user.id,
          },
        });
      }

      dbStore.addChunks(chunkEntities);

      results.push({
        id: docId,
        filename: originalName,
        status: 'COMPLETED',
        file_type: ext,
        chunk_count: chunks.length,
        error_message: null,
      });
    } catch (err: any) {
      console.error(`[Upload] Failed to process ${originalName}:`, err);
      results.push({
        id: 'err_' + crypto.randomBytes(6).toString('hex'),
        filename: originalName,
        status: 'FAILED',
        file_type: ext,
        chunk_count: 0,
        error_message: err.message || 'File parsing error',
      });
    }
  }

  res.json(results);
});

app.get('/api/documents', authMiddleware, (req: AuthRequest, res) => {
  const docs = dbStore.getDocumentsByUser(req.user!.id);
  docs.sort((a, b) => new Date(b.upload_time).getTime() - new Date(a.upload_time).getTime());
  res.json(docs);
});

app.get('/api/documents/:id', authMiddleware, (req: AuthRequest, res) => {
  const doc = dbStore.getDocumentById(req.params.id);
  if (!doc || doc.user_id !== req.user!.id) {
    return res.status(404).json({ detail: 'Document not found.' });
  }
  res.json(doc);
});

app.get('/api/documents/:id/chunks', authMiddleware, (req: AuthRequest, res) => {
  const doc = dbStore.getDocumentById(req.params.id);
  if (!doc || doc.user_id !== req.user!.id) {
    return res.status(404).json({ detail: 'Document not found.' });
  }
  const chunks = dbStore.getChunks(req.user!.id, [req.params.id]);
  // Return chunks without raw vector arrays to keep payload light
  const lightweightChunks = chunks.map((c) => ({
    id: c.id,
    chunk_index: c.chunk_index,
    content: c.content,
    metadata: c.metadata,
  }));
  res.json(lightweightChunks);
});

app.delete('/api/documents/:id', authMiddleware, (req: AuthRequest, res) => {
  const success = dbStore.deleteDocument(req.params.id, req.user!.id);
  if (!success) {
    return res.status(404).json({ detail: 'Document not found.' });
  }
  res.json({ message: 'Document and vectors deleted successfully.' });
});

// -------------------------------------------------------------
// Chat & Agentic RAG Route
// -------------------------------------------------------------
app.post('/api/chat', authMiddleware, async (req: AuthRequest, res) => {
  const { question, document_ids, conversation_id } = req.body;
  const user = req.user!;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ detail: 'Question cannot be empty.' });
  }

  try {
    let history: { role: string; content: string }[] = [];

    // If part of an active conversation, fetch recent history
    if (conversation_id) {
      const pastMessages = dbStore.getMessagesByConversation(conversation_id);
      history = pastMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

      // Record user question
      dbStore.addMessage({
        id: 'msg_' + crypto.randomBytes(8).toString('hex'),
        conversation_id,
        role: 'user',
        content: question.trim(),
        created_at: new Date().toISOString(),
      });
    }

    // Run Agentic RAG Workflow
    const result = await runAgenticRAG(question, user.id, document_ids, history);

    // Save assistant answer if conversation active
    if (conversation_id) {
      dbStore.addMessage({
        id: 'msg_' + crypto.randomBytes(8).toString('hex'),
        conversation_id,
        role: 'assistant',
        content: result.answer,
        sources: JSON.stringify(result.sources),
        created_at: new Date().toISOString(),
      });

      // Update conversation title if needed
      const conv = dbStore.getConversationById(conversation_id, user.id);
      if (conv && conv.title === 'New Conversation') {
        const title = question.slice(0, 36) + (question.length > 36 ? '...' : '');
        dbStore.updateConversation(conversation_id, { title, updated_at: new Date().toISOString() });
      }
    }

    res.json({
      answer: result.answer,
      sources: result.sources,
      metadata: result.metadata,
      conversation_id,
    });
  } catch (err: any) {
    console.error('[Chat] Agentic RAG Error:', err);
    res.status(500).json({ detail: err.message || 'An error occurred during grounded generation.' });
  }
});

// -------------------------------------------------------------
// Conversation Routes
// -------------------------------------------------------------
app.get('/api/conversations', authMiddleware, (req: AuthRequest, res) => {
  const convs = dbStore.getConversationsByUser(req.user!.id);
  res.json(convs);
});

app.post('/api/conversations', authMiddleware, (req: AuthRequest, res) => {
  const { title } = req.body;
  const newConv = {
    id: 'conv_' + crypto.randomBytes(8).toString('hex'),
    user_id: req.user!.id,
    title: title || 'New Conversation',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  dbStore.addConversation(newConv);
  res.status(201).json(newConv);
});

app.get('/api/conversations/:id', authMiddleware, (req: AuthRequest, res) => {
  const conv = dbStore.getConversationById(req.params.id, req.user!.id);
  if (!conv) {
    return res.status(404).json({ detail: 'Conversation not found.' });
  }
  const messages = dbStore.getMessagesByConversation(conv.id);
  res.json({
    id: conv.id,
    title: conv.title,
    messages,
  });
});

app.delete('/api/conversations/:id', authMiddleware, (req: AuthRequest, res) => {
  const success = dbStore.deleteConversation(req.params.id, req.user!.id);
  if (!success) {
    return res.status(404).json({ detail: 'Conversation not found.' });
  }
  res.json({ message: 'Conversation deleted.' });
});

// -------------------------------------------------------------
// Database Endpoints & Vector Store Inspection
// -------------------------------------------------------------
app.get('/api/database/overview', (req, res) => {
  const stats = dbStore.getStats();
  res.json(stats);
});

app.get('/api/database/tables/:name', (req, res) => {
  const tableName = req.params.name;
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;

  const validTables = ['users', 'documents', 'chunks', 'conversations', 'messages'];
  if (!validTables.includes(tableName)) {
    return res.status(400).json({ detail: `Invalid table name. Valid tables: ${validTables.join(', ')}` });
  }

  const result = dbStore.getTableRows(tableName, search, limit, offset);
  res.json(result);
});

app.post('/api/database/vector-search', async (req: Request, res: Response) => {
  const { query, top_k = 5, document_id } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ detail: 'Search query is required for vector similarity comparison.' });
  }

  const start = Date.now();
  try {
    const queryEmbedding = await GeminiService.getEmbedding(query.trim());
    const fastQueryVector = generateFastVector(query.trim(), 128);
    let allChunks = dbStore.getTableRows('chunks', '', 1000, 0).rows;

    if (document_id) {
      allChunks = allChunks.filter((c) => c.document_id === document_id);
    }

    // Retrieve original chunk entities with full embeddings
    const fullChunks = (dbStore as any).data.chunks as DbChunk[];
    const chunkMap = new Map(fullChunks.map((c) => [c.id, c]));

    const scored = allChunks.map((chunkRow) => {
      const full = chunkMap.get(chunkRow.id);
      let similarity = 0;
      if (full?.embedding) {
        if (full.embedding.length === queryEmbedding.length) {
          similarity = cosineSimilarity(queryEmbedding, full.embedding);
        } else if (full.embedding.length === 128) {
          similarity = cosineSimilarity(fastQueryVector, full.embedding);
        } else {
          similarity = cosineSimilarity(queryEmbedding, full.embedding);
        }
      }
      return {
        id: chunkRow.id,
        document_id: chunkRow.document_id,
        chunk_index: chunkRow.chunk_index,
        content: chunkRow.content,
        similarity: Number((similarity || 0).toFixed(4)),
        metadata: chunkRow.metadata,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    const topResults = scored.slice(0, Math.min(Number(top_k) || 5, 20));

    res.json({
      query: query.trim(),
      top_k: Number(top_k) || 5,
      total_chunks_scanned: allChunks.length,
      latency_ms: Date.now() - start,
      vector_dimension: queryEmbedding.length,
      results: topResults,
    });
  } catch (err: any) {
    console.error('[VectorSearch] Error:', err);
    res.status(500).json({ detail: err.message || 'Vector search failed' });
  }
});

app.post('/api/database/seed-sample', (req: Request, res: Response) => {
  let userId = 'user_ambadipudi_rupavani';
  let userEmail = 'ambadipudirupa@gmail.com';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
      const user = dbStore.getUserById(payload.sub);
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    } catch {}
  }

  const result = dbStore.seedSampleKnowledge(userId);
  addServerLog({
    id: 'seed_' + Math.random().toString(36).slice(2, 9),
    timestamp: new Date().toISOString(),
    method: 'SEED',
    path: '/api/database/seed-sample',
    statusCode: 200,
    durationMs: 45,
    type: 'DB_OPERATION',
    details: `Seeded ${result.documentsAdded} documents and ${result.chunksAdded} vector chunks for user ${userEmail}`,
  });
  res.json({
    message: 'Sample knowledge documents, vector embeddings, and conversation seeded successfully.',
    ...result,
  });
});

app.get('/api/database/export', (req: Request, res: Response) => {
  const data = dbStore.exportAll();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="rag_database_export.json"');
  res.send(JSON.stringify(data, null, 2));
});

// -------------------------------------------------------------
// Backend Status, Endpoints Directory & LangGraph Pipeline
// -------------------------------------------------------------
app.get('/api/backend/status', (req, res) => {
  res.json({
    status: 'online',
    serverType: 'Node.js Express + TSX Engine & FastAPI Architecture',
    port: PORT,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    geminiModel: 'gemini-2.5-flash / gemini-3-flash-preview',
    embeddingModel: 'text-embedding-004 / gemini-embedding-2-preview',
    jwtConfigured: !!process.env.JWT_SECRET,
    dataDirectory: path.resolve(process.cwd(), 'data'),
    activeSessions: 1,
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/backend/routes', (req, res) => {
  const routes = [
    { method: 'GET', path: '/api/health', auth: false, tag: 'Health', desc: 'System health check and Gemini configuration probe' },
    { method: 'POST', path: '/api/auth/register', auth: false, tag: 'Auth', desc: 'Create user account with bcrypt salted hash', sampleBody: { name: 'Dr. Alex', email: 'alex@example.com', password: 'Password123!' } },
    { method: 'POST', path: '/api/auth/login', auth: false, tag: 'Auth', desc: 'Authenticate user credentials and receive JWT bearer token', sampleBody: { email: 'researcher@rag.demo', password: 'Password123!' } },
    { method: 'GET', path: '/api/auth/me', auth: true, tag: 'Auth', desc: 'Inspect current user profile and session identity' },
    { method: 'POST', path: '/api/documents/upload', auth: true, tag: 'Documents', desc: 'Upload and parse multi-format documents (PDF, DOCX, XLSX, TXT, CSV) into vector chunks' },
    { method: 'GET', path: '/api/documents', auth: true, tag: 'Documents', desc: 'List all parsed knowledge documents for the current user' },
    { method: 'GET', path: '/api/documents/:id/chunks', auth: true, tag: 'Documents', desc: 'Retrieve parsed chunk text and page/row metadata for a specific document' },
    { method: 'DELETE', path: '/api/documents/:id', auth: true, tag: 'Documents', desc: 'Delete document and cascade-delete its vector embeddings' },
    { method: 'POST', path: '/api/chat', auth: true, tag: 'RAG Pipeline', desc: 'Execute Agentic RAG workflow with LangGraph query routing, relevance grading, and grounded citations', sampleBody: { question: 'What is the main topic of my uploaded document?', document_ids: [] } },
    { method: 'GET', path: '/api/conversations', auth: true, tag: 'Conversations', desc: 'List conversation threads and message counts' },
    { method: 'POST', path: '/api/conversations', auth: true, tag: 'Conversations', desc: 'Create a new conversation session thread', sampleBody: { title: 'Q3 Financial Inquiries' } },
    { method: 'GET', path: '/api/conversations/:id', auth: true, tag: 'Conversations', desc: 'Retrieve full message transcript with source citations' },
    { method: 'DELETE', path: '/api/conversations/:id', auth: true, tag: 'Conversations', desc: 'Delete conversation thread and its message logs' },
    { method: 'GET', path: '/api/database/overview', auth: false, tag: 'Database', desc: 'Inspect database counts, vector dimensions, and storage volume' },
    { method: 'GET', path: '/api/database/tables/:name', auth: false, tag: 'Database', desc: 'Query rows from users, documents, chunks, conversations, or messages' },
    { method: 'POST', path: '/api/database/vector-search', auth: false, tag: 'Database', desc: 'Perform live cosine similarity vector distance evaluation against stored chunks', sampleBody: { query: 'vector index latency', top_k: 3 } },
    { method: 'POST', path: '/api/database/seed-sample', auth: true, tag: 'Database', desc: 'Seed rich knowledge documents, vectors, and demo conversation' },
    { method: 'GET', path: '/api/database/export', auth: true, tag: 'Database', desc: 'Export full database snapshot as downloadable JSON' },
    { method: 'GET', path: '/api/backend/status', auth: false, tag: 'Backend', desc: 'Inspect backend runtime, engine configurations, and uptime' },
    { method: 'GET', path: '/api/backend/pipeline', auth: false, tag: 'Backend', desc: 'LangGraph Agentic RAG state machine nodes and edge definitions' },
    { method: 'GET', path: '/api/backend/logs', auth: false, tag: 'Backend', desc: 'Real-time server event and pipeline execution logs' },
  ];
  res.json(routes);
});

app.get('/api/backend/pipeline', (req, res) => {
  res.json({
    name: 'LangGraph Agentic Multi-Document RAG Graph',
    architecture: 'StateGraph with conditional branching, query rewriting, and hallucination reflection',
    nodes: [
      {
        id: 'node_input',
        title: '1. Question Input & Deconstruction',
        type: 'input',
        description: 'Receives user natural language prompt and contextual conversation history window (last 6 turns).',
        output: 'Cleaned query tokens & document scope filter',
      },
      {
        id: 'node_retriever',
        title: '2. ChromaDB Semantic Vector Retriever',
        type: 'retriever',
        description: 'Generates text embedding (768-D) and calculates cosine similarity across candidate document chunks.',
        parameters: { topK: 12, metric: 'cosine_similarity', defaultCutoff: 0.60 },
        output: 'Top K retrieved candidate chunks with page & row metadata',
      },
      {
        id: 'node_grader',
        title: '3. Relevance Grader & Query Rewriter',
        type: 'evaluator',
        description: 'Evaluates chunk relevance. If similarity/keyword overlap < 0.65, triggers rewrite loop using Gemini.',
        fallbackCondition: 'score < 0.65 -> rewriteQuery() loop (max 1 retry)',
        output: 'Filtered high-relevance chunks',
      },
      {
        id: 'node_generator',
        title: '4. Grounded Synthesis Engine',
        type: 'generator',
        description: 'Prompts Gemini 2.5 Flash with strict grounding instructions and exact metadata citations [Document, Page/Row].',
        model: 'gemini-2.5-flash / gemini-3-flash-preview',
        temperature: 0.2,
        output: 'Synthesized grounded answer with inline bracket citations',
      },
      {
        id: 'node_reflection',
        title: '5. Hallucination Self-Reflection & Audit',
        type: 'verifier',
        description: 'Cross-verifies answer claims against chunk text and formats explicit source citation badges.',
        output: 'Final verified answer + source citation cards',
      },
    ],
  });
});

app.get('/api/backend/logs', (req, res) => {
  res.json(serverLogs);
});

// -------------------------------------------------------------
// Frontend Serving (Vite dev or production static)
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Agentic RAG system ready on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Startup error:', err);
  process.exit(1);
});
