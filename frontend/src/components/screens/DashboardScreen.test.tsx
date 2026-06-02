/**
 * F3.0-fix — DashboardScreen: BlockSafetyMapSection inline tests (failing-first TDD).
 *
 * BlockSafetyMapSection does NOT exist yet — all tests in this file fail on import
 * (or on render) until the implementation is in place.
 *
 * Mocking strategy (mirrors BlockReviewScreen.test.tsx):
 *   - CalendarHeatmap: stubbed to a simple div — tests verify screen wiring, not heatmap internals
 *   - @tanstack/react-query useQuery: mocked via vi.hoisted + vi.mock to control per-block states
 *   - getTrainingBlockScores: mocked via vi.mock on the trainingBlocks module
 *   - DashboardScreen receives engine directly as a prop
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { TrainingBlock, DailySafetyScore } from '../../types';

// ---------------------------------------------------------------------------
// Speculative import — DashboardScreen exists, but BlockSafetyMapSection does not.
// Tests that assert on BlockSafetyMapSection behaviour will fail until it is
// implemented and rendered inside DashboardScreen.
// ---------------------------------------------------------------------------
import { DashboardScreen } from './DashboardScreen';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Stub CalendarHeatmap so we test screen wiring, not the heatmap itself.
vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: ({ startDate, endDate }: { startDate: string; endDate: string }) => (
    <div data-testid="calendar-heatmap" data-start={startDate} data-end={endDate} />
  ),
}));

// Mock getTrainingBlockScores — import will succeed once production code lands.
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

// ---------------------------------------------------------------------------
// useQuery stub factories
// ---------------------------------------------------------------------------

function makeUseQuerySuccess(data: unknown) {
  return {
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function makeUseQueryPending() {
  return {
    data: undefined,
    isPending: true,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function makeUseQueryError() {
  return {
    data: undefined,
    isPending: false,
    isError: true,
    error: new Error('Network error'),
    refetch: vi.fn(),
  };
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
// Render helper — DashboardScreen needs onOpenCheckIn and onOpenLogActivity
// ---------------------------------------------------------------------------

function renderDashboard() {
  return renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// Test a — Active block: CalendarHeatmap rendered without extra useQuery fetch
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: active block heatmap', () => {
  it('renders a CalendarHeatmap for the active block without firing a useQuery for that block id', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];

    // Provide a default useQuery stub — it must NOT be called for the active block id.
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    // CalendarHeatmap must appear for the active block — rendered inline by BlockSafetyMapSection.
    expect(screen.getByTestId('calendar-heatmap')).toBeInTheDocument();

    // useQuery must NOT have been called with ['block-scores', ACTIVE_BLOCK.id].
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
// Test b — One scroll page per previous block, each fires useQuery keyed by block.id
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: one page per previous block', () => {
  it('calls useQuery for each previous block keyed ["block-scores", block.id]', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1, PREV_BLOCK_2];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([]));

    renderDashboard();

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
});

// ---------------------------------------------------------------------------
// Test c — Loading skeleton while a previous-block query is pending
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: loading skeleton', () => {
  it('shows a loading skeleton while a previous-block query is pending', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryPending());

    renderDashboard();

    // The component must render some loading indicator.
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
// Test d — Error state shown; retry button rendered
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: error state', () => {
  it('shows an error state with a retry button when a previous-block query fails', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryError());

    renderDashboard();

    // Error message must appear.
    const errorEl =
      screen.queryByText(/error|failed|could not load/i) ??
      screen.queryByRole('alert');
    expect(errorEl).not.toBeNull();

    // A retry button must render.
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test e — No active block: no scroll container, no CalendarHeatmap
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: no active block', () => {
  it('renders no scroll container and no CalendarHeatmap when engine.block.id is empty', () => {
    mockEngine.block = {
      ...mockEngine.block,
      id: '',
      name: '',
    };
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([]));

    renderDashboard();

    // No scroll container for the block safety map.
    expect(
      screen.queryByTestId('block-safety-map-scroll'),
    ).not.toBeInTheDocument();

    // No CalendarHeatmap at all — there is no block to show.
    expect(screen.queryByTestId('calendar-heatmap')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test f — No previous blocks: exactly one page (the active block)
// ---------------------------------------------------------------------------

describe('DashboardScreen — BlockSafetyMapSection: only active block rendered', () => {
  it('renders exactly one CalendarHeatmap (the active block) when previousBlocks is empty', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([]));

    renderDashboard();

    // Exactly one CalendarHeatmap stub should be in the document.
    const heatmaps = screen.getAllByTestId('calendar-heatmap');
    expect(heatmaps).toHaveLength(1);

    // No previous-block useQuery calls should have been made.
    const blockScoresCalls = useQueryMock.mock.calls.filter(
      (args: unknown[]) => {
        const opts = args[0] as Record<string, unknown> | undefined;
        const queryKey = opts?.queryKey as unknown[] | undefined;
        return Array.isArray(queryKey) && queryKey[0] === 'block-scores';
      },
    );
    expect(blockScoresCalls).toHaveLength(0);
  });
});
