/**
 * F3.0 — trainingBlocks API client tests.
 *
 * Tests for getTrainingBlockScores are written failing-first (TDD).
 * The function does NOT exist in trainingBlocks.ts yet — the import line
 * will cause these tests to fail until the implementation is in place.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
// Speculative import — getTrainingBlockScores does not exist yet.
import { getTrainingBlockScores } from './trainingBlocks';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test 7 — getTrainingBlockScores maps API response to camelCase DailySafetyScore[]
// ---------------------------------------------------------------------------

describe('getTrainingBlockScores', () => {
  it('fetches /training-blocks/:id/scores and maps snake_case response to camelCase DailySafetyScore[]', async () => {
    const snakeResponse = {
      block_id: 'blk-prev-1',
      start_date: '2026-04-01',
      end_date: '2026-04-30',
      scores: [
        {
          date: '2026-04-01',
          state: 'safe',
          violations: [],
          had_flare_up: false,
        },
        {
          date: '2026-04-02',
          state: 'caution',
          violations: [
            {
              rule_id: 'rule-1',
              rule_type: 'rest_between_class',
              message: 'Too soon',
              severity: 'caution',
            },
          ],
          had_flare_up: true,
        },
        {
          date: '2026-04-03',
          state: 'danger',
          violations: [],
          had_flare_up: false,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(snakeResponse));

    const result = await getTrainingBlockScores('blk-prev-1');

    // Should hit the correct endpoint.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/training-blocks/blk-prev-1/scores',
      expect.any(Object),
    );

    // Result must be an array of DailySafetyScore (camelCase fields).
    expect(result).toHaveLength(3);

    // First score — simple safe day.
    expect(result[0]).toMatchObject({
      date: '2026-04-01',
      state: 'safe',
      violations: [],
      hadFlareUp: false,
    });
    // Snake-case keys must NOT appear on the result.
    expect(result[0]).not.toHaveProperty('had_flare_up');

    // Second score — caution with a violation, hadFlareUp true.
    expect(result[1]).toMatchObject({
      date: '2026-04-02',
      state: 'caution',
      hadFlareUp: true,
    });
    expect(result[1]!.violations).toHaveLength(1);
    expect(result[1]!.violations[0]).toMatchObject({
      ruleId: 'rule-1',
      ruleType: 'rest_between_class',
      message: 'Too soon',
      severity: 'caution',
    });
    // Snake-case keys must not be on the violation.
    expect(result[1]!.violations[0]).not.toHaveProperty('rule_id');

    // Third score — danger day.
    expect(result[2]).toMatchObject({
      date: '2026-04-03',
      state: 'danger',
      hadFlareUp: false,
    });
  });

  it('returns an empty array when scores array is empty', async () => {
    const snakeResponse = {
      block_id: 'blk-empty',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      scores: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(snakeResponse));

    const result = await getTrainingBlockScores('blk-empty');

    expect(result).toEqual([]);
  });
});
