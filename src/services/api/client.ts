/**
 * Local API client with ephemeral token management and automatic 401 retry.
 */

import {
  ApiError,
  type DefaultModel,
  type GeminiCredentialsStatus,
  type GeminiTestResponse,
  type HealthResponse,
  type ModelsResponse,
} from './types';

const BASE_URL = '/api/v1';

// Ephemeral per-startup session token: kept ONLY in this module variable
let sessionToken: string | null = null;
let bootstrapPromise: Promise<string> | null = null;

export function getCachedToken(): string | null {
  return sessionToken;
}

export function resetSessionToken(): void {
  sessionToken = null;
  bootstrapPromise = null;
}

/**
 * Fetch the ephemeral per-startup token via GET /api/v1/bootstrap.
 * De-duplicates concurrent calls.
 */
export async function getBootstrapToken(forceRefresh = false): Promise<string> {
  if (sessionToken && !forceRefresh) {
    return sessionToken;
  }

  if (bootstrapPromise && !forceRefresh) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/bootstrap`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new ApiError(
          'auth',
          `Failed to bootstrap session (status ${res.status})`,
          res.status,
        );
      }

      const data = (await res.json()) as { token: string };
      if (!data.token) {
        throw new ApiError('auth', 'Invalid bootstrap response: missing token', 500);
      }

      sessionToken = data.token;
      return sessionToken;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        'network',
        'Backend not reachable. Start it with npm run dev.',
        0,
      );
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  requiresAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const execute = async (tokenOverride?: string): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (requiresAuth) {
      const token = tokenOverride ?? (await getBootstrapToken());
      headers['X-ChatBrain-Token'] = token;
    }

    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response: Response;
  try {
    response = await execute();
  } catch {
    throw new ApiError('network', 'Backend not reachable. Start it with npm run dev.', 0);
  }

  // On 401, re-fetch /bootstrap and retry exactly ONCE
  if (response.status === 401 && requiresAuth) {
    let freshToken: string;
    try {
      freshToken = await getBootstrapToken(true);
      response = await execute(freshToken);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('network', 'Backend not reachable. Start it with npm run dev.', 0);
    }
  }

  if (!response.ok) {
    let errCategory: ApiError['category'] = 'internal';
    let errMessage = `Request failed with status ${response.status}`;

    try {
      const errorJson = (await response.json()) as {
        error?: { category?: ApiError['category']; message?: string };
      };
      if (errorJson?.error) {
        if (errorJson.error.category) errCategory = errorJson.error.category;
        if (errorJson.error.message) errMessage = errorJson.error.message;
      }
    } catch {
      // Fall back to default status-based error message
    }

    throw new ApiError(errCategory, errMessage, response.status);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Typed API Endpoints
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { method: 'GET', requiresAuth: false });
}

export async function getCredentialsStatus(): Promise<GeminiCredentialsStatus> {
  return request<GeminiCredentialsStatus>('/credentials/gemini', { method: 'GET' });
}

export async function saveGeminiKey(apiKey: string): Promise<GeminiCredentialsStatus> {
  return request<GeminiCredentialsStatus>('/credentials/gemini', {
    method: 'PUT',
    body: { api_key: apiKey },
  });
}

export async function testGeminiKey(): Promise<GeminiTestResponse> {
  return request<GeminiTestResponse>('/credentials/gemini/test', { method: 'POST' });
}

export async function deleteGeminiKey(): Promise<GeminiCredentialsStatus> {
  return request<GeminiCredentialsStatus>('/credentials/gemini', { method: 'DELETE' });
}

export async function listModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>('/models', { method: 'GET' });
}

export async function refreshModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>('/models/refresh', { method: 'POST' });
}

export async function getDefaultModel(): Promise<DefaultModel> {
  return request<DefaultModel>('/models/default', { method: 'GET' });
}

export async function setDefaultModel(modelId: string, force = false): Promise<DefaultModel> {
  return request<DefaultModel>('/models/default', {
    method: 'PUT',
    body: { model_id: modelId, force },
  });
}

export async function clearDefaultModel(): Promise<DefaultModel> {
  return request<DefaultModel>('/models/default', { method: 'DELETE' });
}
