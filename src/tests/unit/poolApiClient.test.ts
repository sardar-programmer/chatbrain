import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getFailovers,
  getModelsHealth,
  getPool,
  resetHealth,
  resetSessionToken,
  scanModels,
  setPoolExcluded,
} from '../../services/api/client';
import { ApiError } from '../../services/api/types';

describe('Pool and Health API Client functions', () => {
  beforeEach(() => {
    resetSessionToken();
    vi.restoreAllMocks();
  });

  const setupMockBootstrapAndError = (status = 422, message = 'Validation failed') => {
    return vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/bootstrap')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: 'test-token' }),
        });
      }
      return Promise.resolve({
        ok: false,
        status,
        json: () =>
          Promise.resolve({
            error: { category: 'validation', message },
          }),
      });
    });
  };

  it('setPoolExcluded maps errors to ApiError and does not leak request body in error', async () => {
    const mockFetch = setupMockBootstrapAndError(
      422,
      'Cannot exclude the last remaining chat model from the auto pool',
    );
    vi.stubGlobal('fetch', mockFetch);

    try {
      await setPoolExcluded('model-secret', true);
      expect.fail('Should have thrown ApiError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.category).toBe('validation');
      expect(apiErr.status).toBe(422);
      expect(apiErr.message).toBe('Cannot exclude the last remaining chat model from the auto pool');
      expect(apiErr.message).not.toContain('{"excluded":true}');
    }
  });

  it('getModelsHealth maps network errors to ApiError', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/bootstrap')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ token: 'test-token' }),
        });
      }
      return Promise.reject(new Error('Connection refused'));
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(getModelsHealth()).rejects.toThrow(ApiError);
  });

  it('getPool maps 401 and not_found errors to ApiError', async () => {
    const mockFetch = setupMockBootstrapAndError(404, 'Pool configuration not found');
    vi.stubGlobal('fetch', mockFetch);

    await expect(getPool()).rejects.toThrow(ApiError);
  });

  it('scanModels and resetHealth map errors to ApiError', async () => {
    const mockFetch = setupMockBootstrapAndError(500, 'Upstream failure');
    vi.stubGlobal('fetch', mockFetch);

    await expect(scanModels(4)).rejects.toThrow(ApiError);
    await expect(resetHealth()).rejects.toThrow(ApiError);
  });

  it('getFailovers maps errors to ApiError', async () => {
    const mockFetch = setupMockBootstrapAndError(400, 'Invalid limit query parameter');
    vi.stubGlobal('fetch', mockFetch);

    await expect(getFailovers(20)).rejects.toThrow(ApiError);
  });
});
