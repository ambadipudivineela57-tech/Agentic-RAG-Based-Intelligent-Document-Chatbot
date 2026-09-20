import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DbUser, DbDocument, DbChunk, DbConversation, DbMessage } from './types';

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
    if (!this.data.users.find((u) => u.email === 'researcher@rag.demo')) {
      this.seedDefaultUser();
      this.save();
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
}

export const dbStore = new Store();
