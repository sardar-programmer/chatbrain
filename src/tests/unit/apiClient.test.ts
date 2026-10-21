import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCredentialsStatus,
  resetSessionToken,
  saveGeminiKey,
} from '../../services/api/client';
import { ApiError } from '../../services/api/types';

describe('API Client', () => {
  beforeEach(() => {
    resetSessionToken();
    vi.restoreAllMocks();
  });

  it('retries once on 401 after re-fetching token and then succeeds', async () => {
    let callCount = 0;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      // 1. Initial bootstrap
      if (url.endsWith('/bootstrap')) {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: `token-${callCount}` }),
        });
      }

      // 2. Main request: fail first with 401, then succeed with fresh token
      if (url.endsWith('/credentials/gemini')) {
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () =>
              Promise.resolve({
                error: { category: 'auth', message: 'Token expired' },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ configured: true, hint: '1234' }),
        });
      }

      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    vi.stubGlobal('fetch', mockFetch);

    const result = await getCredentialsStatus();
    expect(result).toEqual({ configured: true, hint: '1234' });
    // Expected calls: 1: bootstrap, 2: credentials (401), 3: bootstrap (re-fetch), 4: credentials (200)
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('throws when second attempt after 401 still fails with 401', async () => {
    let bootstrapCount = 0;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/bootstrap')) {
        bootstrapCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: `token-${bootstrapCount}` }),
        });
      }

      if (url.endsWith('/credentials/gemini')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              error: { category: 'auth', message: 'Persistent unauthorized' },
            }),
        });
      }

      return Promise.reject(new Error('Unknown URL'));
    });

    vi.stubGlobal('fetch', mockFetch);

    await expect(getCredentialsStatus()).rejects.toThrow(ApiError);
    // bootstrap -> creds (401) -> bootstrap -> creds (401) -> throw
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('maps backend error body to typed ApiError', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/bootstrap')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: 'test-token' }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { category: 'provider', message: 'Invalid API key' },
          }),
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    try {
      await saveGeminiKey('bad-key');
      expect.fail('Should have thrown ApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.category).toBe('provider');
      expect(apiErr.message).toBe('Invalid API key');
      expect(apiErr.status).toBe(400);
    }
  });

  it('maps network failures to category "network" with friendly message', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    try {
      await getCredentialsStatus();
      expect.fail('Should have thrown ApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.category).toBe('network');
      expect(apiErr.message).toBe('Backend not reachable. Start it with npm run dev.');
    }
  });

  it('never leaks the request body or raw secret in error message or representation', async () => {
    const secretKey = 'super-secret-gemini-key-99999999999';

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/bootstrap')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: 'test-token' }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { category: 'provider', message: 'Upstream rejection' },
          }),
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    try {
      await saveGeminiKey(secretKey);
      expect.fail('Should have thrown ApiError');
    } catch (err: unknown) {
      const errorStr = String(err);
      expect(errorStr).not.toContain(secretKey);
      if (err instanceof Error) {
        expect(err.message).not.toContain(secretKey);
      }
    }
  });
});
