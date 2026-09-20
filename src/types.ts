export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  file_hash: string;
  upload_time: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunk_count: number;
  error_message?: string | null;
}

export interface DocumentUploadResult {
  id: string;
  filename: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  file_type: string;
  chunk_count: number;
  error_message?: string | null;
}

export interface SourceCitation {
  document: string;
  document_id?: string | null;
  page?: number | null;
  sheet?: string | null;
  section?: string | null;
  row_range?: string | null;
  chunk_id?: number | string | null;
  snippet?: string | null;
}

export interface ChatMetadata {
  retry_count: number;
  retrieved_chunk_count: number;
  rewritten_query?: string | null;
  relevance_score?: number | null;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceCitation[];
  metadata?: ChatMetadata;
  created_at?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}
