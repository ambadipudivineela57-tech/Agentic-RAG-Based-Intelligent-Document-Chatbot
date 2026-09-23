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
import { GeminiService } from './server/geminiService';
import { runAgenticRAG } from './server/agenticRag';
import { DbUser, DbDocument, DbChunk } from './server/types';

dotenv.config();

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rag-super-secret-key-2025';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
// Frontend Serving (Vite dev or production static)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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
