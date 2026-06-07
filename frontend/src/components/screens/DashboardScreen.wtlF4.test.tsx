/**
 * WTL.F4 — Dashboard load-tax graph wiring (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F4
 *
 * Covers: last-30-days window, effort-load subtitle, no /0 header metric,
 * and performance-class graph title.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { TrainingBlock } from '../../types';
import {
  WTL_F4_AS_OF,
  WTL_F4_BLOCK_START,
  WTL_F4_CLASS_FOOT,
  WTL_F4_GRAPH_START,
  WTL_F4_LATEST_LOAD,
  WTL_F4_SUBTITLE,
  wtlF4LoadSeries,
} from '../../test/wtlF4LoadGraphFixtures';
import { DashboardScreen } from './DashboardScreen';

vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: () => <div data-testid="calendar-heatmap" />,
}));

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
  id: 'blk-wtl-f4',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: WTL_F4_BLOCK_START,
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-04-07T06:00:00Z',
};

function makeUseQuerySuccess() {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function setupDashboardLoadGraph(
  options: {
    weekLoadThreshold?: number | null;
    graphClassId?: string | null;
  } = {},
): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.todayDate = WTL_F4_AS_OF;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  mockEngine.recoveryStreaks = [];
  mockEngine.activityClasses = [WTL_F4_CLASS_FOOT];
  mockEngine.activities = [];
  mockEngine.suggestionBuckets = [];
  mockEngine.weeklyProgress = [];
  mockEngine.hasCheckedInToday = true;
  mockEngine.loadSeries = wtlF4LoadSeries;
  mockEngine.flareUpDates = [];
  mockEngine.graphClassId = options.graphClassId ?? WTL_F4_CLASS_FOOT.id;
  mockEngine.weekLoadThreshold =
    options.weekLoadThreshold === undefined ? null : options.weekLoadThreshold;
}

function loadGraphCard(): HTMLElement {
  const title = screen.getByRole('heading', { name: 'Foot load' });
  const card = title.closest('.rounded-lg') as HTMLElement | null;
  if (card == null) {
    throw new Error('Expected dashboard load graph card');
  }
  return card;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

beforeEach(() => {
  useQueryMock.mockReturnValue(makeUseQuerySuccess());
});

describe('DashboardScreen — WTL.F4 load-tax graph', () => {
  it('plots the last 30 days ending on today, not the full block start date', () => {
    setupDashboardLoadGraph();

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('img', {
        name: new RegExp(
          `7-day rolling load from ${WTL_F4_GRAPH_START} to ${WTL_F4_AS_OF}`,
          'i',
        ),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', {
        name: new RegExp(`from ${WTL_F4_BLOCK_START}`, 'i'),
      }),
    ).not.toBeInTheDocument();
  });

  it('renders the rolling effort-load subtitle for the dashboard graph', () => {
    setupDashboardLoadGraph();

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(screen.getByText(WTL_F4_SUBTITLE)).toBeInTheDocument();
    expect(screen.queryByText('Rolling 7-day · full block')).not.toBeInTheDocument();
  });

  it('shows the latest load-tax metric without a / 0 cap suffix when threshold is null', () => {
    setupDashboardLoadGraph({ weekLoadThreshold: null });

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    const card = loadGraphCard();
    expect(within(card).getByText(String(WTL_F4_LATEST_LOAD))).toBeInTheDocument();
    expect(within(card).queryByText(/\/\s*0/)).not.toBeInTheDocument();
  });

  it('keeps the performance class name as the graph title', () => {
    setupDashboardLoadGraph({ graphClassId: WTL_F4_CLASS_FOOT.id });

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(screen.getByText('Foot load')).toBeInTheDocument();
  });
});
