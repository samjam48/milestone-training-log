/**
 * F1.4 — dashboard API client tests (written before coverage gate lands).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDashboard } from './dashboard';
import { dashboardReadSnake } from './testFixtures';
import { mapDashboardFromApi } from './mappers';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches /dashboard and maps payload through mapDashboardFromApi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(dashboardReadSnake));
    globalThis.fetch = fetchMock;

    const result = await getDashboard();

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard', expect.any(Object));
    expect(result).toEqual(mapDashboardFromApi(dashboardReadSnake));
  });

  it('sends as_of query param when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(dashboardReadSnake));
    globalThis.fetch = fetchMock;

    await getDashboard('2026-05-28');

    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard?as_of=2026-05-28', expect.any(Object));
  });
});
