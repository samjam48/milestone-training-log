/**
 * F1.4 — load API client tests (written before coverage gate lands).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkViolations, getDelayedTax, getLoadSummary } from './load';
import { ruleViolationReadSnakeCaution } from './testFixtures';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('load API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('checkViolations POSTs snake_case body to /load/check-violations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ violations: [ruleViolationReadSnakeCaution] }),
    );
    globalThis.fetch = fetchMock;

    const result = await checkViolations({
      activityId: 'act-walk',
      volumeValue: 2.5,
      rpe: 5,
      asOf: '2026-05-25',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/load/check-violations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          activity_id: 'act-walk',
          volume_value: 2.5,
          rpe: 5,
          as_of: '2026-05-25',
        }),
      }),
    );
    expect(result.violations[0]?.ruleId).toBe('rule-rest-foot');
    expect(result.violations[0]?.severity).toBe('caution');
  });

  it('getLoadSummary sends optional as_of query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        as_of: '2026-05-25',
        class_statuses: [],
        suggestions: [],
        weekly_progress: [],
      }),
    );
    globalThis.fetch = fetchMock;

    const result = await getLoadSummary({ asOf: '2026-05-25' });

    expect(fetchMock).toHaveBeenCalledWith('/api/load/summary?as_of=2026-05-25', expect.any(Object));
    expect(result.asOf).toBe('2026-05-25');
    expect(result.classStatuses).toEqual([]);
  });

  it('getDelayedTax forwards optional query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        as_of: '2026-05-25',
        risk_window_days: 7,
        baseline_days: 14,
        pain_threshold: 3,
        hits: [{ activity_id: 'act-walk', risk_score: 0.8 }],
      }),
    );
    globalThis.fetch = fetchMock;

    const result = await getDelayedTax({
      asOf: '2026-05-25',
      riskWindowDays: 7,
      baselineDays: 14,
      painThreshold: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/load/delayed-tax?as_of=2026-05-25&risk_window_days=7&baseline_days=14&pain_threshold=3',
      expect.any(Object),
    );
    expect(result.hits[0]).toMatchObject({ activityId: 'act-walk', riskScore: 0.8 });
  });
});
