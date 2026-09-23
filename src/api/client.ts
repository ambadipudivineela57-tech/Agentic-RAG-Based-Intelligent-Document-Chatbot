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

export default api;
