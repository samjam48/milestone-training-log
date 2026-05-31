/**
 * F3.0 — BlockReviewScreen tests (failing-first TDD).
 *
 * BlockReviewScreen does NOT exist yet — all tests fail on import until the
 * implementation is in place.
 *
 * Mocking strategy:
 *   - useMilestoneEngine: mocked to return mockEngine
 *   - @tanstack/react-query useQuery: mocked per-test to control loading/error/data
 *   - CalendarHeatmap: stubbed to a simple div — tests verify screen wiring, not heatmap internals
 *   - getTrainingBlockScores: mocked via vi.mock on the trainingBlocks module
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { TrainingBlock, DailySafetyScore } from '../../types';

// ---------------------------------------------------------------------------
// Speculative import — BlockReviewScreen does not exist yet; tests fail here.
// ---------------------------------------------------------------------------
import { BlockReviewScreen } from './BlockReviewScreen';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Stub CalendarHeatmap so we test screen wiring, not the heatmap itself.
vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: ({ startDate, endDate }: { startDate: string; endDate: string }) => (
    <div data-testid="calendar-heatmap" data-start={startDate} data-end={endDate} />
  ),
}));

// Mock useMilestoneEngine so BlockReviewScreen reads from mockEngine.
vi.mock('../../hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

// Mock getTrainingBlockScores — does not exist yet, import will fail until production code lands.
const { getTrainingBlockScoresMock } = vi.hoisted(() => ({
  getTrainingBlockScoresMock: vi.fn(),
}));
vi.mock('../../lib/api/trainingBlocks', () => ({
  listTrainingBlocks: vi.fn().mockResolvedValue([]),
  getActiveTrainingBlock: vi.fn().mockResolvedValue(null),
  createTrainingBlock: vi.fn().mockResolvedValue({}),
  patchTrainingBlock: vi.fn().mockResolvedValue({}),
  getTrainingBlockScores: getTrainingBlockScoresMock,
}));

// Mock @tanstack/react-query useQuery so tests can control per-block query states.
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const PREV_BLOCK_1: TrainingBlock = {
  id: 'blk-prev-1',
  userId: 'user-1',
  name: 'April Block',
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-04-01T00:00:00Z',
};

const PREV_BLOCK_2: TrainingBlock = {
  id: 'blk-prev-2',
  userId: 'user-1',
  name: 'March Block',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  status: 'completed',
  isReviewMilestoneHit: false,
  createdAt: '2026-03-01T00:00:00Z',
};

const DAILY_SCORES: DailySafetyScore[] = [
  { date: '2026-05-01', state: 'safe', violations: [], hadFlareUp: false },
  { date: '2026-05-02', state: 'caution', violations: [], hadFlareUp: false },
];

// Default useQuery stub — returns data with no extra fetch needed for active block.
function makeUseQuerySuccess(data: unknown) {
  return vi.fn().mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

function makeUseQueryPending() {
  return vi.fn().mockReturnValue({
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
}

function makeUseQueryError() {
  return vi.fn().mockReturnValue({
    data: undefined,
    isPending: false,
    isError: true,
    error: new Error('Network error'),
    refetch: vi.fn(),
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test 1 — Active block heatmap rendered with pre-loaded scores
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — active block heatmap', () => {
  it('renders CalendarHeatmap for the active block without firing an extra useQuery fetch', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];

    // For the active block, no extra query should be fired (scores come from engine).
    // Provide a mock that tracks calls — it should not be called with block-scores key.
    useQueryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    // CalendarHeatmap stub must appear for the active block.
    expect(screen.getByTestId('calendar-heatmap')).toBeInTheDocument();

    // useQuery must NOT have been called with ['block-scores', ACTIVE_BLOCK.id]
    // because active block scores come from the dashboard pre-load.
    const blockScoresCalls = useQueryMock.mock.calls.filter(
      (args: unknown[]) => {
        const opts = args[0] as Record<string, unknown> | undefined;
        const queryKey = opts?.queryKey as unknown[] | undefined;
        return (
          Array.isArray(queryKey) &&
          queryKey[0] === 'block-scores' &&
          queryKey[1] === ACTIVE_BLOCK.id
        );
      },
    );
    expect(blockScoresCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — One page per previous block, each fires useQuery keyed by block.id
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — one page per previous block', () => {
  it('calls useQuery for each previous block keyed ["block-scores", block.id]', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1, PREV_BLOCK_2];

    useQueryMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    // Each previous block must cause one useQuery call with the block id in the key.
    const blockScoresCalls = useQueryMock.mock.calls.filter(
      (args: unknown[]) => {
        const opts = args[0] as Record<string, unknown> | undefined;
        const queryKey = opts?.queryKey as unknown[] | undefined;
        return Array.isArray(queryKey) && queryKey[0] === 'block-scores';
      },
    );
    const fetchedIds = blockScoresCalls.map((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown>;
      const queryKey = opts.queryKey as unknown[];
      return queryKey[1];
    });

    expect(fetchedIds).toContain(PREV_BLOCK_1.id);
    expect(fetchedIds).toContain(PREV_BLOCK_2.id);
  });

  it('renders a section for each previous block name', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1, PREV_BLOCK_2];

    useQueryMock.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    expect(screen.getByText(PREV_BLOCK_1.name)).toBeInTheDocument();
    expect(screen.getByText(PREV_BLOCK_2.name)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Loading skeleton while a previous-block query is pending
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — loading skeleton', () => {
  it('shows a loading skeleton while a previous-block query is pending', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryPending()());

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    // The component must render some loading indicator (skeleton, spinner, or "loading" text).
    const skeleton =
      screen.queryByTestId('block-scores-loading') ??
      screen.queryByRole('status') ??
      screen.queryByText(/loading/i) ??
      document.querySelector('[aria-busy="true"]') ??
      document.querySelector('.skeleton') ??
      document.querySelector('[data-loading]');

    expect(skeleton).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Error state shown; retry button rendered; does not crash other pages
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — error state', () => {
  it('shows an error state with a retry button when a previous-block query fails', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryError()());

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    // Error message must appear.
    const errorEl =
      screen.queryByText(/error|failed|could not load/i) ??
      screen.queryByRole('alert');
    expect(errorEl).not.toBeNull();

    // A retry button must render.
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not crash when one previous-block errors and another succeeds', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [PREV_BLOCK_1, PREV_BLOCK_2];

    let callCount = 0;
    useQueryMock.mockImplementation(() => {
      callCount++;
      // First call (PREV_BLOCK_1) errors; second (PREV_BLOCK_2) succeeds.
      if (callCount === 1) {
        return makeUseQueryError()();
      }
      return makeUseQuerySuccess([])();
    });

    expect(() => {
      renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);
    }).not.toThrow();

    // The successful block's name should still render.
    expect(screen.getByText(PREV_BLOCK_2.name)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Back button calls onBack prop
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — back button', () => {
  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([])());

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={onBack} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — No-block empty state
// ---------------------------------------------------------------------------

describe('BlockReviewScreen — no-block empty state', () => {
  it('shows empty state and no scroll container when engine has no active block', () => {
    mockEngine.block = {
      ...mockEngine.block,
      id: '',
      name: '',
    };
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([])());

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    // Some empty-state message must appear.
    const emptyEl =
      screen.queryByText(/no block|no training block|nothing to review/i) ??
      screen.queryByTestId('block-review-empty');
    expect(emptyEl).not.toBeNull();

    // No scrollable block list container should be rendered.
    expect(screen.queryByTestId('block-review-scroll')).not.toBeInTheDocument();
  });
});
