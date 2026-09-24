import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DbUser, DbDocument, DbChunk, DbConversation, DbMessage } from './types';
import { generateFastVector } from './geminiService';

interface DatabaseSchema {
  users: DbUser[];
  documents: DbDocument[];
  chunks: DbChunk[];
  conversations: DbConversation[];
  messages: DbMessage[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app_store.json');

class Store {
  private data: DatabaseSchema = {
    users: [],
    documents: [],
    chunks: [],
    conversations: [],
    messages: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('[DB] Failed to load DB file, initializing fresh:', err);
      }
    } else {
      this.seedDefaultUser();
      this.save();
    }

    // Ensure demo users exist
    if (!this.data.users.find((u) => u.email === 'ambadipudirupa@gmail.com')) {
      this.seedRupavaniUser();
      this.save();
    }
    if (!this.data.users.find((u) => u.email === 'ambadipudivineela57@gmail.com')) {
      this.seedVineelaUser();
      this.save();
    }
    if (!this.data.users.find((u) => u.email === 'researcher@rag.demo')) {
      this.seedDefaultUser();
      this.save();
    }

    // Auto-seed documents for demo accounts if empty
    const rupavaniUser = this.data.users.find((u) => u.email === 'ambadipudirupa@gmail.com');
    if (rupavaniUser && this.getDocumentsByUser(rupavaniUser.id).length === 0) {
      this.seedSampleKnowledge(rupavaniUser.id);
    }
    const vineelaUser = this.data.users.find((u) => u.email === 'ambadipudivineela57@gmail.com');
    if (vineelaUser && this.getDocumentsByUser(vineelaUser.id).length === 0) {
      this.seedSampleKnowledge(vineelaUser.id);
    }
  }

  private seedRupavaniUser() {
    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync('Password123!', salt);
    this.data.users.push({
      id: 'user_ambadipudi_rupavani',
      name: 'Ambadipudi Rupavani',
      email: 'ambadipudirupa@gmail.com',
      hashed_password: hashed,
      created_at: new Date().toISOString(),
    });
  }

  private seedVineelaUser() {
    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync('Password123!', salt);
    this.data.users.push({
      id: 'user_ambadipudi_vineela',
      name: 'Ambadipudi Vineela',
      email: 'ambadipudivineela57@gmail.com',
      hashed_password: hashed,
      created_at: new Date().toISOString(),
    });
  }

  private seedDefaultUser() {
    const salt = bcrypt.genSaltSync(10);
    const hashed = bcrypt.hashSync('Password123!', salt);
    this.data.users.push({
      id: 'demo-user-titan-001',
      name: 'Dr. Alex Rivera',
      email: 'researcher@rag.demo',
      hashed_password: hashed,
      created_at: new Date().toISOString(),
    });
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to write DB file:', err);
    }
  }

  // Users
  getUserByEmail(email: string): DbUser | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): DbUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  addUser(user: DbUser): DbUser {
    this.data.users.push(user);
    this.save();
    return user;
  }

  // Documents
  getDocumentsByUser(userId: string): DbDocument[] {
    return this.data.documents.filter((d) => d.user_id === userId);
  }

  getDocumentById(id: string): DbDocument | undefined {
    return this.data.documents.find((d) => d.id === id);
  }

  addDocument(doc: DbDocument): DbDocument {
    this.data.documents.push(doc);
    this.save();
    return doc;
  }

  updateDocument(id: string, updates: Partial<DbDocument>): DbDocument | undefined {
    const doc = this.data.documents.find((d) => d.id === id);
    if (doc) {
      Object.assign(doc, updates);
      this.save();
    }
    return doc;
  }

  deleteDocument(id: string, userId: string): boolean {
    const initLen = this.data.documents.length;
    this.data.documents = this.data.documents.filter((d) => !(d.id === id && d.user_id === userId));
    // Also delete chunks
    this.data.chunks = this.data.chunks.filter((c) => !(c.document_id === id && c.user_id === userId));
    this.save();
    return this.data.documents.length < initLen;
  }

  // Chunks & Vectors
  addChunks(newChunks: DbChunk[]) {
    this.data.chunks.push(...newChunks);
    this.save();
  }

  getChunks(userId: string, documentIds?: string[]): DbChunk[] {
    let result = this.data.chunks.filter((c) => c.user_id === userId);
    if (documentIds && documentIds.length > 0) {
      result = result.filter((c) => documentIds.includes(c.document_id));
    }
    return result;
  }

  // Conversations
  getConversationsByUser(userId: string): (DbConversation & { message_count: number })[] {
    return this.data.conversations
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((c) => {
        const count = this.data.messages.filter((m) => m.conversation_id === c.id).length;
        return { ...c, message_count: count };
      });
  }

  getConversationById(id: string, userId: string): DbConversation | undefined {
    return this.data.conversations.find((c) => c.id === id && c.user_id === userId);
  }

  addConversation(conv: DbConversation): DbConversation {
    this.data.conversations.push(conv);
    this.save();
    return conv;
  }

  updateConversation(id: string, updates: Partial<DbConversation>) {
    const conv = this.data.conversations.find((c) => c.id === id);
    if (conv) {
      Object.assign(conv, updates);
      this.save();
    }
  }

  deleteConversation(id: string, userId: string): boolean {
    const initLen = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => !(c.id === id && c.user_id === userId));
    this.data.messages = this.data.messages.filter((m) => m.conversation_id !== id);
    this.save();
    return this.data.conversations.length < initLen;
  }

  // Messages
  getMessagesByConversation(conversationId: string): DbMessage[] {
    return this.data.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  addMessage(msg: DbMessage): DbMessage {
    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  // Database Management & Stats
  getStats() {
    let fileSize = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        fileSize = fs.statSync(DB_FILE).size;
      }
    } catch {
      fileSize = 0;
    }

    return {
      usersCount: this.data.users.length,
      documentsCount: this.data.documents.length,
      chunksCount: this.data.chunks.length,
      conversationsCount: this.data.conversations.length,
      messagesCount: this.data.messages.length,
      vectorCount: this.data.chunks.filter((c) => c.embedding && c.embedding.length > 0).length,
      vectorDimensions: this.data.chunks[0]?.embedding?.length || 768,
      storageSizeBytes: fileSize,
      databaseType: 'SQLite / JSON Relational + Vector Store',
      chromaCollection: 'langchain_document_embeddings',
      lastUpdated: new Date().toISOString(),
    };
  }

  getTableRows(tableName: string, search = '', limit = 50, offset = 0) {
    let rows: any[] = [];
    const s = search.toLowerCase().trim();

    if (tableName === 'users') {
      rows = this.data.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        created_at: u.created_at,
        password_hash: '••••••••[bcrypt-masked]••••••••',
      }));
      if (s) {
        rows = rows.filter((r) => r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s));
      }
    } else if (tableName === 'documents') {
      rows = [...this.data.documents];
      if (s) {
        rows = rows.filter(
          (r) =>
            r.original_filename.toLowerCase().includes(s) ||
            r.file_type.toLowerCase().includes(s) ||
            r.status.toLowerCase().includes(s)
        );
      }
    } else if (tableName === 'chunks') {
      rows = this.data.chunks.map((c) => ({
        id: c.id,
        document_id: c.document_id,
        user_id: c.user_id,
        chunk_index: c.chunk_index,
        content: c.content,
        embedding_dimension: c.embedding?.length || 0,
        embedding_sample: c.embedding ? c.embedding.slice(0, 5).map((v) => Number(v.toFixed(4))) : [],
        metadata: c.metadata,
      }));
      if (s) {
        rows = rows.filter(
          (r) =>
            r.content.toLowerCase().includes(s) ||
            (r.metadata?.filename && r.metadata.filename.toLowerCase().includes(s))
        );
      }
    } else if (tableName === 'conversations') {
      rows = [...this.data.conversations];
      if (s) {
        rows = rows.filter((r) => r.title.toLowerCase().includes(s));
      }
    } else if (tableName === 'messages') {
      rows = [...this.data.messages];
      if (s) {
        rows = rows.filter((r) => r.content.toLowerCase().includes(s) || r.role.toLowerCase().includes(s));
      }
    }

    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);
    return { total, rows: paginated };
  }

  exportAll(): DatabaseSchema {
    return {
      users: this.data.users.map((u) => ({ ...u, hashed_password: '[REDACTED]' })),
      documents: this.data.documents,
      chunks: this.data.chunks,
      conversations: this.data.conversations,
      messages: this.data.messages,
    };
  }

  seedSampleKnowledge(userId: string) {
    const timestamp = new Date().toISOString();

    const sampleDocs = [
      {
        id: 'doc_seed_rag_arch',
        filename: `${userId}_seed_rag_arch_Enterprise_AI_Architecture.pdf`,
        original_filename: 'Enterprise_AI_Architecture_2025.pdf',
        file_type: 'PDF',
        file_size: 2458000,
        file_hash: '8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c',
        upload_time: timestamp,
        status: 'COMPLETED' as const,
        chunk_count: 3,
        error_message: null,
      },
      {
        id: 'doc_seed_financial',
        filename: `${userId}_seed_financial_Q3_Financial_Summary.xlsx`,
        original_filename: 'Q3_Global_Financial_Performance.xlsx',
        file_type: 'XLSX',
        file_size: 894000,
        file_hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
        upload_time: timestamp,
        status: 'COMPLETED' as const,
        chunk_count: 2,
        error_message: null,
      },
      {
        id: 'doc_seed_sec',
        filename: `${userId}_seed_sec_Global_Security_Compliance.docx`,
        original_filename: 'Global_Security_Compliance_Standard.docx',
        file_type: 'DOCX',
        file_size: 1350000,
        file_hash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
        upload_time: timestamp,
        status: 'COMPLETED' as const,
        chunk_count: 2,
        error_message: null,
      },
    ];

    // Remove old seed docs if any
    const seedDocIds = sampleDocs.map((d) => d.id);
    this.data.documents = this.data.documents.filter((d) => !(d.user_id === userId && seedDocIds.includes(d.id)));
    this.data.chunks = this.data.chunks.filter((c) => !(c.user_id === userId && seedDocIds.includes(c.document_id)));

    // Add sample docs
    for (const doc of sampleDocs) {
      this.data.documents.push({
        ...doc,
        user_id: userId,
      });
    }

    // Add Chunks with fast semantic vectors
    const sampleChunks: DbChunk[] = [
      {
        id: 'doc_seed_rag_arch_chunk_0',
        document_id: 'doc_seed_rag_arch',
        user_id: userId,
        chunk_index: 0,
        content:
          'Executive Summary: The Enterprise AI architecture incorporates Agentic RAG patterns utilizing LangGraph state machines, multi-stage retrieval with HNSW vector indices, and Gemini 2.5 Flash for grounded generation. Query latency p95 is under 420ms across 1.2M document segments.',
        embedding: generateFastVector('Executive Summary: The Enterprise AI architecture incorporates Agentic RAG patterns utilizing LangGraph state machines, multi-stage retrieval with HNSW vector indices, and Gemini 2.5 Flash for grounded generation. Query latency p95 is under 420ms across 1.2M document segments.', 128),
        metadata: {
          filename: 'Enterprise_AI_Architecture_2025.pdf',
          page: 1,
          section: 'Executive Architecture Overview',
          document_id: 'doc_seed_rag_arch',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_rag_arch_chunk_1',
        document_id: 'doc_seed_rag_arch',
        user_id: userId,
        chunk_index: 1,
        content:
          'Retrieval Evaluation & Routing: Before synthesis, retrieved passages are scored by an isolated relevance evaluator. Only passages with cosine similarity above 0.65 are passed to the generator. If no passages pass the threshold, the system invokes the query rewriter.',
        embedding: generateFastVector('Retrieval Evaluation & Routing: Before synthesis, retrieved passages are scored by an isolated relevance evaluator. Only passages with cosine similarity above 0.65 are passed to the generator. If no passages pass the threshold, the system invokes the query rewriter.', 128),
        metadata: {
          filename: 'Enterprise_AI_Architecture_2025.pdf',
          page: 3,
          section: 'Relevance Grading & Fallback Loops',
          document_id: 'doc_seed_rag_arch',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_rag_arch_chunk_2',
        document_id: 'doc_seed_rag_arch',
        user_id: userId,
        chunk_index: 2,
        content:
          'Vector Index Performance: ChromaDB embedded SQLite storage scales to 500k vectors per node with sub-5ms cosine distance lookups. Embedding dimension is configured for 768 float32 dimensions with automatic L2 normalization.',
        embedding: generateFastVector('Vector Index Performance: ChromaDB embedded SQLite storage scales to 500k vectors per node with sub-5ms cosine distance lookups. Embedding dimension is configured for 768 float32 dimensions with automatic L2 normalization.', 128),
        metadata: {
          filename: 'Enterprise_AI_Architecture_2025.pdf',
          page: 7,
          section: 'Vector Index Benchmarks',
          document_id: 'doc_seed_rag_arch',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_financial_chunk_0',
        document_id: 'doc_seed_financial',
        user_id: userId,
        chunk_index: 0,
        content:
          'Sheet: Revenue Breakdown. Q3 Total Gross Revenue reached $48.2M, representing a 28.4% YoY expansion. Enterprise ARR stands at $184.6M with net dollar retention of 118%. Gross profit margins improved to 76.5%.',
        embedding: generateFastVector('Sheet: Revenue Breakdown. Q3 Total Gross Revenue reached $48.2M, representing a 28.4% YoY expansion. Enterprise ARR stands at $184.6M with net dollar retention of 118%. Gross profit margins improved to 76.5%.', 128),
        metadata: {
          filename: 'Q3_Global_Financial_Performance.xlsx',
          sheet: 'Revenue Breakdown',
          row_range: 'Rows 1-45',
          document_id: 'doc_seed_financial',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_financial_chunk_1',
        document_id: 'doc_seed_financial',
        user_id: userId,
        chunk_index: 1,
        content:
          'Sheet: Operating Expenses. R&D expenditure for Q3 totaled $16.4M, with AI compute and vector database infrastructure accounting for 34% of cloud expenses. Operating cash flow closed at positive $7.8M for the quarter.',
        embedding: generateFastVector('Sheet: Operating Expenses. R&D expenditure for Q3 totaled $16.4M, with AI compute and vector database infrastructure accounting for 34% of cloud expenses. Operating cash flow closed at positive $7.8M for the quarter.', 128),
        metadata: {
          filename: 'Q3_Global_Financial_Performance.xlsx',
          sheet: 'Operating Expenses',
          row_range: 'Rows 46-90',
          document_id: 'doc_seed_financial',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_sec_chunk_0',
        document_id: 'doc_seed_sec',
        user_id: userId,
        chunk_index: 0,
        content:
          'Data Governance & Encryption: All customer documents and chunked embeddings are encrypted in transit via TLS 1.3 and at rest using AES-256-GCM. Vector embeddings are tied strictly to user_id access control boundaries.',
        embedding: generateFastVector('Data Governance & Encryption: All customer documents and chunked embeddings are encrypted in transit via TLS 1.3 and at rest using AES-256-GCM. Vector embeddings are tied strictly to user_id access control boundaries.', 128),
        metadata: {
          filename: 'Global_Security_Compliance_Standard.docx',
          section: 'Section 4: Cryptographic Controls',
          document_id: 'doc_seed_sec',
          user_id: userId,
        },
      },
      {
        id: 'doc_seed_sec_chunk_1',
        document_id: 'doc_seed_sec',
        user_id: userId,
        chunk_index: 1,
        content:
          'Regulatory Compliance: The platform maintains SOC 2 Type II certification, ISO 27001 validation, and GDPR data residency compliance with automatic 90-day data retention purging policies.',
        embedding: generateFastVector('Regulatory Compliance: The platform maintains SOC 2 Type II certification, ISO 27001 validation, and GDPR data residency compliance with automatic 90-day data retention purging policies.', 128),
        metadata: {
          filename: 'Global_Security_Compliance_Standard.docx',
          section: 'Section 9: Audits & Compliance',
          document_id: 'doc_seed_sec',
          user_id: userId,
        },
      },
    ];

    this.data.chunks.push(...sampleChunks);

    // Create a demo conversation if user has none
    const existingUserConvs = this.data.conversations.filter((c) => c.user_id === userId);
    if (existingUserConvs.length === 0) {
      const convId = 'conv_seed_demo_' + Date.now().toString(36);
      this.data.conversations.unshift({
        id: convId,
        user_id: userId,
        title: 'Enterprise Architecture & Financials Q&A',
        created_at: timestamp,
        updated_at: timestamp,
      });

      this.data.messages.push(
        {
          id: 'msg_seed_1',
          conversation_id: convId,
          role: 'user',
          content: 'What was the Q3 gross revenue and what is our vector retrieval latency target?',
          created_at: timestamp,
        },
        {
          id: 'msg_seed_2',
          conversation_id: convId,
          role: 'assistant',
          content:
            'Based on the uploaded documents:\n\n* **Gross Revenue**: Q3 Total Gross Revenue reached **$48.2M** (28.4% YoY expansion), with Enterprise ARR at **$184.6M** and gross margins at 76.5% (*[Q3_Global_Financial_Performance.xlsx, Sheet: Revenue Breakdown]*).\n* **Vector Retrieval Latency**: The architecture targets a p95 query latency under **420ms** across 1.2M document segments, with ChromaDB vector distance lookups executing in sub-5ms (*[Enterprise_AI_Architecture_2025.pdf, Page 1 & Page 7]*).',
          sources: JSON.stringify([
            {
              document: 'Q3_Global_Financial_Performance.xlsx',
              page: 'Sheet: Revenue Breakdown',
              snippet: 'Q3 Total Gross Revenue reached $48.2M, representing a 28.4% YoY expansion...',
            },
            {
              document: 'Enterprise_AI_Architecture_2025.pdf',
              page: 'Page 1, Executive Architecture Overview',
              snippet: 'Query latency p95 is under 420ms across 1.2M document segments...',
            },
          ]),
          created_at: timestamp,
        }
      );
    }

    this.save();
    return {
      documentsAdded: sampleDocs.length,
      chunksAdded: sampleChunks.length,
    };
  }
}

export const dbStore = new Store();
