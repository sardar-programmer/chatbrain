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

export interface Model {
  id: string;
  display_name: string;
  provider: string;
  capabilities: string[];
  input_token_limit: number | null;
  output_token_limit: number | null;
  supported_actions: string[];
  status: string;
  last_checked: string;
  kind: string;
  kind_inferred: boolean;
}

export interface DefaultModel {
  model_id: string | null;
  valid: boolean;
  reason: string | null;
}

export interface ModelsResponse {
  models: Model[];
  connected: boolean;
  default_chat_model: DefaultModel | null;
}
