/**
 * F1.2 — apiFetch / ApiError client tests (written before implementation).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, apiFetchOrNullOn404, ApiError } from './client';
import { fastApiDetailErrorBody } from './testFixtures';

const originalFetch = globalThis.fetch;

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
  });

  it('requests relative /api paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    globalThis.fetch = fetchMock;

    await apiFetch<{ status: string }>('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
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
