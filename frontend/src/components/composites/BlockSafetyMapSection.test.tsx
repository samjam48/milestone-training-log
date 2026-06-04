/**
 * B10.4 — BlockSafetyMapSection uses /review (getTrainingBlockReview), not /scores.
 *
 * Failing until PreviousBlockPage switches from getTrainingBlockScores to review dailyScores.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { TrainingBlock, DailySafetyScore } from '../../types';
import { BlockSafetyMapSection } from './BlockSafetyMapSection';

vi.mock('./CalendarHeatmap', () => ({
  CalendarHeatmap: ({
    startDate,
    endDate,
    scores,
  }: {
    startDate: string;
    endDate: string;
    scores: DailySafetyScore[];
  }) => (
    <div
      data-testid="calendar-heatmap"
      data-start={startDate}
      data-end={endDate}
      data-score-count={scores.length}
    />
  ),
}));

const { getTrainingBlockReviewMock } = vi.hoisted(() => ({
  getTrainingBlockReviewMock: vi.fn(),
}));

vi.mock('../../lib/api/trainingBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/trainingBlocks')>();
  return {
    ...actual,
    getTrainingBlockReview: getTrainingBlockReviewMock,
  };
});

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'May Rehab Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const PREV_BLOCK: TrainingBlock = {
  id: 'blk-prev-1',
  userId: 'user-1',
  name: 'April Block',
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-04-01T00:00:00Z',
};

const REVIEW_DAILY_SCORES: DailySafetyScore[] = [
  { date: '2026-04-01', state: 'safe', violations: [], hadFlareUp: false },
  { date: '2026-04-02', state: 'caution', violations: [], hadFlareUp: false },
];

function makeUseQuerySuccess(data: unknown) {
  return {
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('BlockSafetyMapSection — B10.4 review fetch', () => {
  it('uses getTrainingBlockReview in queryFn keyed ["block-review", block.id] for previous blocks', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK];

    useQueryMock.mockReturnValue(
      makeUseQuerySuccess({ dailyScores: REVIEW_DAILY_SCORES }),
    );

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const reviewCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return Array.isArray(queryKey) && queryKey[0] === 'block-review';
    });
    expect(reviewCalls.length).toBeGreaterThan(0);

    const prevBlockCall = reviewCalls.find((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown>;
      const queryKey = opts.queryKey as unknown[];
      return queryKey[1] === PREV_BLOCK.id;
    });
    expect(prevBlockCall).toBeDefined();

    const opts = prevBlockCall![0] as {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
    };
    expect(opts.queryKey).toEqual(['block-review', PREV_BLOCK.id]);

    void opts.queryFn();
    expect(getTrainingBlockReviewMock).toHaveBeenCalledWith(PREV_BLOCK.id);
  });

  it('does not use block-scores query key for previous blocks', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK];

    useQueryMock.mockReturnValue(
      makeUseQuerySuccess({ dailyScores: REVIEW_DAILY_SCORES }),
    );

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const scoresKeyCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return Array.isArray(queryKey) && queryKey[0] === 'block-scores';
    });
    expect(scoresKeyCalls).toHaveLength(0);
  });

  it('passes review dailyScores to CalendarHeatmap for previous blocks', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK];

    useQueryMock.mockReturnValue(
      makeUseQuerySuccess({ dailyScores: REVIEW_DAILY_SCORES }),
    );

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const heatmaps = screen.getAllByTestId('calendar-heatmap');
    const prevHeatmap = heatmaps.find(
      (el) => el.getAttribute('data-score-count') === String(REVIEW_DAILY_SCORES.length),
    );
    expect(prevHeatmap).toBeDefined();
    expect(prevHeatmap).toHaveAttribute('data-start', PREV_BLOCK.startDate);
    expect(prevHeatmap).toHaveAttribute('data-end', PREV_BLOCK.endDate);
  });

  it('active block heatmap uses engine.dailyScores without a review fetch', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = REVIEW_DAILY_SCORES;
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const reviewCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return Array.isArray(queryKey) && queryKey[0] === 'block-review';
    });
    expect(reviewCalls).toHaveLength(0);

    const heatmap = screen.getByTestId('calendar-heatmap');
    expect(heatmap).toHaveAttribute(
      'data-score-count',
      String(REVIEW_DAILY_SCORES.length),
    );
  });

  it('shows empty heatmap when review returns empty dailyScores', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK];

    useQueryMock.mockReturnValue(makeUseQuerySuccess({ dailyScores: [] }));

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const heatmaps = screen.getAllByTestId('calendar-heatmap');
    const emptyPrevHeatmap = heatmaps.find(
      (el) =>
        el.getAttribute('data-start') === PREV_BLOCK.startDate &&
        el.getAttribute('data-score-count') === '0',
    );
    expect(emptyPrevHeatmap).toBeDefined();
  });
});
