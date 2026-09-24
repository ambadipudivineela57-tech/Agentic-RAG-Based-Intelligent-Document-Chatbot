import axios from 'axios';
import {
  User,
  DocumentItem,
  DocumentUploadResult,
  ChatMessage,
  Conversation,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rag_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401s to prompt re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if expired/invalid
      localStorage.removeItem('rag_token');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  async register(name: string, email: string, password: string): Promise<User> {
    const res = await api.post<User>('/auth/register', { name, email, password });
    return res.data;
  },

  async login(email: string, password: string): Promise<{ access_token: string }> {
    const res = await api.post<{ access_token: string }>('/auth/login', { email, password });
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },
};

export const documentApi = {
  async list(): Promise<DocumentItem[]> {
    const res = await api.get<DocumentItem[]>('/documents');
    return res.data;
  },

  async upload(files: File[]): Promise<DocumentUploadResult[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const res = await api.post<DocumentUploadResult[]>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async delete(documentId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/documents/${documentId}`);
    return res.data;
  },

  async getChunks(documentId: string): Promise<Array<{
    id: string;
    chunk_index: number;
    content: string;
    metadata: {
      page?: number;
      sheet?: string;
      section?: string;
      row_range?: string;
      filename?: string;
    };
  }>> {
    const res = await api.get(`/documents/${documentId}/chunks`);
    return res.data;
  },
};

export const chatApi = {
  async sendMessage(
    question: string,
    documentIds?: string[],
    conversationId?: string | null
  ): Promise<{
    answer: string;
    sources: any[];
    metadata: any;
    conversation_id?: string;
  }> {
    const res = await api.post('/chat', {
      question,
      document_ids: documentIds && documentIds.length > 0 ? documentIds : [],
      conversation_id: conversationId || null,
    });
    return res.data;
  },
};

export const conversationApi = {
  async list(): Promise<Conversation[]> {
    const res = await api.get<Conversation[]>('/conversations');
    return res.data;
  },

  async create(title?: string): Promise<Conversation> {
    const res = await api.post<Conversation>('/conversations', {
      title: title || 'New Conversation',
    });
    return res.data;
  },

  async get(id: string): Promise<{
    id: string;
    title: string;
    messages: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      sources?: string | null;
      created_at: string;
    }[];
  }> {
    const res = await api.get(`/conversations/${id}`);
    return res.data;
  },

  async delete(id: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/conversations/${id}`);
    return res.data;
  },
};

export const healthApi = {
  async getHealth(): Promise<{ status: string; geminiConfigured: boolean }> {
    const res = await api.get<{ status: string; geminiConfigured: boolean }>('/health');
    return res.data;
  },
};

export interface DatabaseStats {
  usersCount: number;
  documentsCount: number;
  chunksCount: number;
  conversationsCount: number;
  messagesCount: number;
  vectorCount: number;
  vectorDimensions: number;
  storageSizeBytes: number;
  databaseType: string;
  chromaCollection: string;
  lastUpdated: string;
}

export interface VectorSearchResult {
  query: string;
  top_k: number;
  total_chunks_scanned: number;
  latency_ms: number;
  vector_dimension: number;
  results: Array<{
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    similarity: number;
    metadata: any;
  }>;
}

export const databaseApi = {
  async getOverview(): Promise<DatabaseStats> {
    const res = await api.get<DatabaseStats>('/database/overview');
    return res.data;
  },

  async getTableRows(tableName: string, search = '', limit = 50, offset = 0): Promise<{ total: number; rows: any[] }> {
    const res = await api.get<{ total: number; rows: any[] }>(`/database/tables/${tableName}`, {
      params: { search, limit, offset },
    });
    return res.data;
  },

  async testVectorSearch(query: string, top_k = 5, document_id?: string): Promise<VectorSearchResult> {
    const res = await api.post<VectorSearchResult>('/database/vector-search', {
      query,
      top_k,
      document_id,
    });
    return res.data;
  },

  async seedSampleKnowledge(): Promise<{ message: string; documentsAdded: number; chunksAdded: number }> {
    const res = await api.post<{ message: string; documentsAdded: number; chunksAdded: number }>('/database/seed-sample');
    return res.data;
  },

  getExportUrl(): string {
    return '/api/database/export';
  },
};

export interface BackendStatus {
  status: string;
  serverType: string;
  port: number;
  nodeVersion: string;
  uptimeSeconds: number;
  geminiConfigured: boolean;
  geminiModel: string;
  embeddingModel: string;
  jwtConfigured: boolean;
  dataDirectory: string;
  activeSessions: number;
  environment: string;
}

export interface ApiRouteInfo {
  method: string;
  path: string;
  auth: boolean;
  tag: string;
  desc: string;
  sampleBody?: any;
}

export interface PipelineNode {
  id: string;
  title: string;
  type: string;
  description: string;
  parameters?: any;
  fallbackCondition?: string;
  model?: string;
  temperature?: number;
  output: string;
}

export interface PipelineInfo {
  name: string;
  architecture: string;
  nodes: PipelineNode[];
}

export interface ServerLogItem {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  type: string;
  details?: string;
}

export const backendApi = {
  async getStatus(): Promise<BackendStatus> {
    const res = await api.get<BackendStatus>('/backend/status');
    return res.data;
  },

  async getRoutes(): Promise<ApiRouteInfo[]> {
    const res = await api.get<ApiRouteInfo[]>('/backend/routes');
    return res.data;
  },

  async getPipeline(): Promise<PipelineInfo> {
    const res = await api.get<PipelineInfo>('/backend/pipeline');
    return res.data;
  },

  async getLogs(): Promise<ServerLogItem[]> {
    const res = await api.get<ServerLogItem[]>('/backend/logs');
    return res.data;
  },

  async runCustomRequest(method: string, path: string, body?: any): Promise<{ status: number; duration: number; data: any }> {
    const start = Date.now();
    try {
      const res = await api.request({
        method: method as any,
        url: path.replace(/^\/api/, ''),
        data: body,
      });
      return { status: res.status, duration: Date.now() - start, data: res.data };
    } catch (err: any) {
      return {
        status: err.response?.status || 500,
        duration: Date.now() - start,
        data: err.response?.data || { error: err.message },
      };
    }
  },
};

export default api;
