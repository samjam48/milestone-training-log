/**
 * F1.2 — apiFetch / ApiError client tests.
 * F11.1 — session credentials, VITE_API_BASE_URL, 401 / isUnauthorizedError.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiFetch,
  apiFetchOrNullOn404,
  ApiError,
  isUnauthorizedError,
} from './client';
import { fastApiDetailErrorBody } from './testFixtures';

const originalFetch = globalThis.fetch;

const unauthorizedErrorBody = JSON.stringify({
  detail: 'Not authenticated',
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('requests relative /api paths with credentials include', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    globalThis.fetch = fetchMock;

    await apiFetch<{ status: string }>('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    );
  });

  it('prefixes fetch URL with VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    globalThis.fetch = fetchMock;

    await apiFetch<{ status: string }>('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/health',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses relative /api path when VITE_API_BASE_URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    globalThis.fetch = fetchMock;

    await apiFetch<{ status: string }>('/dashboard');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws ApiError with status 401 on unauthorized response', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(unauthorizedErrorBody, { status: 401 }));

    await expect(apiFetch('/dashboard')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.message).toBe('Not authenticated');
      return true;
    });
  });

  it('returns parsed JSON for 2xx responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'log-1' }));

    const result = await apiFetch<{ id: string }>('/activity-logs/log-1');

    expect(result).toEqual({ id: 'log-1' });
  });

  it('throws ApiError on non-2xx with parsed FastAPI detail', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 404 }));

    await expect(apiFetch('/activity-logs/missing')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.message).toBe('Activity not found');
      return true;
    });
  });

  it('handles 204 DELETE with empty body without JSON parse', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiFetch<void>('/activity-logs/log-1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('throws ApiError with fallback message when error response is not JSON', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    await expect(apiFetch('/dashboard')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.status).toBe(500);
      expect(apiError.message).toBeTruthy();
      return true;
    });
  });
});

describe('apiFetchOrNullOn404', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('passes credentials include to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'ci-1' }));
    globalThis.fetch = fetchMock;

    await apiFetchOrNullOn404<{ id: string }>('/daily-check-ins/today');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/daily-check-ins/today',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('returns null on 404 without throwing', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 404 }));

    const result = await apiFetchOrNullOn404<Record<string, unknown>>('/daily-check-ins/today');

    expect(result).toBeNull();
  });

  it('returns parsed JSON on 2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'ci-1' }));

    const result = await apiFetchOrNullOn404<{ id: string }>('/daily-check-ins/today');

    expect(result).toEqual({ id: 'ci-1' });
  });

  it('rethrows non-404 ApiError', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 422 }));

    await expect(apiFetchOrNullOn404('/daily-check-ins/today')).rejects.toBeInstanceOf(ApiError);
  });

  it('rethrows 401 ApiError instead of returning null', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(unauthorizedErrorBody, { status: 401 }));

    await expect(apiFetchOrNullOn404('/daily-check-ins/today')).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
        return true;
      },
    );
  });
});

describe('isUnauthorizedError', () => {
  it('returns true for ApiError with status 401', () => {
    expect(isUnauthorizedError(new ApiError(401, 'Not authenticated'))).toBe(true);
  });

  it('returns false for other ApiError statuses', () => {
    expect(isUnauthorizedError(new ApiError(404, 'Not found'))).toBe(false);
    expect(isUnauthorizedError(new ApiError(422, 'Validation failed'))).toBe(false);
  });

  it('returns false for non-ApiError values', () => {
    expect(isUnauthorizedError(new Error('generic'))).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
    expect(isUnauthorizedError('401')).toBe(false);
  });
});

describe('ApiError', () => {
  it('exposes status, message, and optional detail', () => {
    const error = new ApiError(422, 'Validation failed', [{ loc: ['body'], msg: 'bad' }]);

    expect(error.status).toBe(422);
    expect(error.message).toBe('Validation failed');
    expect(error.detail).toEqual([{ loc: ['body'], msg: 'bad' }]);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });
});
