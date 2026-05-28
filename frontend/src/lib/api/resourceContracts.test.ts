/**
 * F1.2 — list query params and 404→null resource helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listActivityLogs } from './activityLogs';
import { getTodayDailyCheckIn, getDailyCheckInByDate, listDailyCheckIns } from './dailyCheckIns';
import { getActiveTrainingBlock } from './trainingBlocks';
import { fastApiDetailErrorBody } from './testFixtures';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('list date filters use backend from/to query keys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('listActivityLogs sends from and to', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchMock;

    await listActivityLogs({
      startDate: '2026-05-01',
      endDate: '2026-05-28',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity-logs?from=2026-05-01&to=2026-05-28',
      expect.any(Object),
    );
  });

  it('listDailyCheckIns sends from and to', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchMock;

    await listDailyCheckIns({
      startDate: '2026-05-01',
      endDate: '2026-05-28',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/daily-check-ins?from=2026-05-01&to=2026-05-28',
      expect.any(Object),
    );
  });
});

describe('optional singleton reads return null on 404', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getTodayDailyCheckIn returns null when missing', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 404 }));

    await expect(getTodayDailyCheckIn()).resolves.toBeNull();
  });

  it('getDailyCheckInByDate returns null when missing', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 404 }));

    await expect(getDailyCheckInByDate('2026-05-28')).resolves.toBeNull();
  });

  it('getActiveTrainingBlock returns null when missing', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(fastApiDetailErrorBody, { status: 404 }));

    await expect(getActiveTrainingBlock()).resolves.toBeNull();
  });
});
