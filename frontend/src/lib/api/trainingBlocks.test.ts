/**
 * B10.4 — trainingBlocks API client: /scores removed, /review is canonical.
 * WTL.F7 — weekly focus setup, reset, and focus title patch helpers.
 *
 * Failing until getTrainingBlockScores is removed and callers use getTrainingBlockReview.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as trainingBlocks from './trainingBlocks';
import {
  getTrainingBlockReview,
  setupWeeklyFocus,
  resetWeeklyFocus,
  patchTrainingBlock,
} from './trainingBlocks';
import {
  WTL_F7_ACTIVE_WEEKLY_FOCUS,
  WTL_F7_RESET_FOCUS_BLOCK,
  weeklyFocusBlockSnake,
} from '../../test/wtlF7WeeklyFocusFixtures';

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

describe('B10.4 — getTrainingBlockScores removal', () => {
  it('does not export getTrainingBlockScores', () => {
    expect('getTrainingBlockScores' in trainingBlocks).toBe(false);
  });
});

describe('getTrainingBlockReview', () => {
  it('fetches /training-blocks/:id/review and maps daily_scores to camelCase dailyScores', async () => {
    const snakeResponse = {
      block: {
        id: 'blk-prev-1',
        user_id: 'user-1',
        name: 'April Block',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        status: 'completed',
        is_review_milestone_hit: true,
        created_at: '2026-04-01T00:00:00Z',
      },
      daily_scores: [
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
      ],
      load_series: [{ date: '2026-04-01', load: 10 }],
      flare_up_dates: ['2026-04-02'],
      total_sessions: 2,
      clean_days: 1,
    };

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(snakeResponse));

    const result = await getTrainingBlockReview('blk-prev-1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/training-blocks/blk-prev-1/review',
      expect.any(Object),
    );

    expect(result.dailyScores).toHaveLength(2);
    expect(result.dailyScores[0]).toMatchObject({
      date: '2026-04-01',
      state: 'safe',
      violations: [],
      hadFlareUp: false,
    });
    expect(result.dailyScores[1]).toMatchObject({
      date: '2026-04-02',
      state: 'caution',
      hadFlareUp: true,
    });
    expect(result.dailyScores[0]).not.toHaveProperty('had_flare_up');
    expect(result.block.id).toBe('blk-prev-1');
    expect(result.flareUpDates).toEqual(['2026-04-02']);
    expect(result.totalSessions).toBe(2);
    expect(result.cleanDays).toBe(1);
  });

  it('maps focus_title and week_number on review block payload', async () => {
    const snakeResponse = {
      block: weeklyFocusBlockSnake(WTL_F7_ACTIVE_WEEKLY_FOCUS),
      daily_scores: [],
      load_series: [],
      flare_up_dates: [],
      total_sessions: 0,
      clean_days: 0,
    };

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(snakeResponse));

    const result = await getTrainingBlockReview(WTL_F7_ACTIVE_WEEKLY_FOCUS.id);

    expect(result.block).toMatchObject({
      id: WTL_F7_ACTIVE_WEEKLY_FOCUS.id,
      focusTitle: WTL_F7_ACTIVE_WEEKLY_FOCUS.focusTitle,
      weekNumber: WTL_F7_ACTIVE_WEEKLY_FOCUS.weekNumber,
      periodKind: 'weekly_focus',
    });
  });

  it('returns empty dailyScores when review payload has no scored days', async () => {
    const snakeResponse = {
      block: {
        id: 'blk-empty',
        user_id: 'user-1',
        name: 'Empty Block',
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        status: 'completed',
        is_review_milestone_hit: false,
        created_at: '2026-03-01T00:00:00Z',
      },
      daily_scores: [],
      load_series: [],
      flare_up_dates: [],
      total_sessions: 0,
      clean_days: 0,
    };

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(snakeResponse));

    const result = await getTrainingBlockReview('blk-empty');

    expect(result.dailyScores).toEqual([]);
  });
});

describe('WTL.F7 — weekly focus API helpers', () => {
  it('exports setupWeeklyFocus and resetWeeklyFocus', () => {
    expect(typeof setupWeeklyFocus).toBe('function');
    expect(typeof resetWeeklyFocus).toBe('function');
  });

  it('setupWeeklyFocus POSTs /training-blocks/active/setup with focus_title', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(weeklyFocusBlockSnake(WTL_F7_RESET_FOCUS_BLOCK), 201),
    );

    const result = await setupWeeklyFocus({ focusTitle: 'First weekly focus' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/training-blocks/active/setup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ focus_title: 'First weekly focus' }),
      }),
    );
    expect(result).toMatchObject({
      focusTitle: WTL_F7_RESET_FOCUS_BLOCK.focusTitle,
      weekNumber: 1,
      periodKind: 'weekly_focus',
    });
  });

  it('resetWeeklyFocus POSTs /training-blocks/active/reset-focus with focus_title', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(weeklyFocusBlockSnake(WTL_F7_RESET_FOCUS_BLOCK), 201),
    );

    const result = await resetWeeklyFocus({ focusTitle: 'Build running base' });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/training-blocks/active/reset-focus',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ focus_title: 'Build running base' }),
      }),
    );
    expect(result).toMatchObject({
      focusTitle: 'Build running base',
      weekNumber: 1,
    });
  });

  it('patchTrainingBlock sends focus_title in snake_case for title edits', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ...weeklyFocusBlockSnake(WTL_F7_ACTIVE_WEEKLY_FOCUS),
        focus_title: 'Stronger ankles',
        name: 'Stronger ankles · Week 3',
      }),
    );

    const result = await patchTrainingBlock(WTL_F7_ACTIVE_WEEKLY_FOCUS.id, {
      focusTitle: 'Stronger ankles',
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/training-blocks/${WTL_F7_ACTIVE_WEEKLY_FOCUS.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ focus_title: 'Stronger ankles' }),
      }),
    );
    expect(result).toMatchObject({
      focusTitle: 'Stronger ankles',
      weekNumber: 3,
    });
  });
});
