/**
 * API types matching Chat-Brain backend v1 endpoints.
 */

export type ApiErrorCategory =
  | 'validation'
  | 'auth'
  | 'not_found'
  | 'provider'
  | 'internal'
  | 'network';

export class ApiError extends Error {
  readonly category: ApiErrorCategory;
  readonly status: number;

  constructor(category: ApiErrorCategory, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.category = category;
    this.status = status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface HealthResponse {
  status: string;
  version: string;
  db: boolean;
}

export interface BootstrapResponse {
  token: string;
}

export interface GeminiCredentialsStatus {
  configured: boolean;
  hint: string | null;
}

export interface GeminiTestResponse {
  ok: boolean;
  message: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationListResponse {
  items: ConversationItem[];
  next_cursor: string | null;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: 'sending' | 'streaming' | 'done' | 'error' | 'failed' | 'stopped';
  error_category?: string | null;
  model_used?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ConversationDetailResponse {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  messages: MessageItem[];
}
