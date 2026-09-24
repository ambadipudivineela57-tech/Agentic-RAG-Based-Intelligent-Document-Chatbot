export interface DbUser {
  id: string;
  name: string;
  email: string;
  hashed_password: string;
  created_at: string;
}

export interface DbDocument {
  id: string;
  user_id: string;
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

export interface DbChunk {
  id: string;
  document_id: string;
  user_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: {
    filename: string;
    page?: number | null;
    sheet?: string | null;
    section?: string | null;
    row_range?: string | null;
    chunk_id?: number | null;
    document_id: string;
    user_id: string;
  };
}

export interface DbConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: string | null;
  created_at: string;
}
