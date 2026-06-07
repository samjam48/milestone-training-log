/**
 * F3.0-fix — DashboardScreen: BlockSafetyMapSection inline tests.
 * B10.4 — previous-block fetches use getTrainingBlockReview (/review), not /scores.
 * F10.1 — Dashboard recovery streaks section (plans/tickets-phase-10-polish-2026-06-04.md).
 * F10.2 — Dashboard clean streak relabel (plans/tickets-phase-10-polish-2026-06-04.md).
 * Load-risk panel removed from dashboard (owner feedback 2026-06-04); delayed tax kept on incident/check-in flows.
 * F10.5 — Load graph title from engine.graphClassId (plans/tickets-phase-10-polish-2026-06-04.md).
 * S25.F2 — Goals dashboard card (plans/tickets-stage-2-5-usage-logic-2026-06-06.md).
 *
 * Mocking strategy (mirrors BlockReviewScreen.test.tsx):
 *   - CalendarHeatmap: stubbed to a simple div — tests verify screen wiring, not heatmap internals
 *   - @tanstack/react-query useQuery: mocked via vi.hoisted + vi.mock to control per-block states
 *   - getTrainingBlockReview: mocked via vi.mock on the trainingBlocks module
 *   - DashboardScreen receives engine directly as a prop
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { LoadRiskSummary } from '../../lib/engine';
import type { ActivityClass, TrainingBlock, DailySafetyScore, RecoveryStreak } from '../../types';
import {
  goalDashboardRowAchieved,
  goalDashboardRowNumeric,
  goalDashboardRowQualitative,
  type GoalDashboardRow,
} from '../../test/goalDashboardRowFixtures';
import { DashboardScreen } from './DashboardScreen';

type EngineWithGoalRows = MilestoneEngineResult & { goalRows: GoalDashboardRow[] };

function assignGoalRows(rows: GoalDashboardRow[]): void {
  (mockEngine as EngineWithGoalRows).goalRows = rows;
}

vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: ({ startDate, endDate }: { startDate: string; endDate: string }) => (
    <div data-testid="calendar-heatmap" data-start={startDate} data-end={endDate} />
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

const DAILY_RECOVERY_STREAK: RecoveryStreak = {
  recoveryTargetId: 'rt-stretch',
  activityId: 'act-stretch',
  activityName: 'Stretching',
  activityClassId: 'cls-mobility',
  targetFrequency: 1,
  frequencyUnit: 'daily',
  currentStreakDays: 4,
};

const WEEKLY_RECOVERY_STREAK: RecoveryStreak = {
  recoveryTargetId: 'rt-contrast',
  activityId: 'act-contrast',
  activityName: 'Contrast therapy',
  activityClassId: 'cls-recovery',
  targetFrequency: 3,
  frequencyUnit: 'weekly',
  currentStreakDays: 2,
};

const FOOT_PERFORMANCE_CLASS: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-04-07T06:00:00Z',
};

const ARM_PERFORMANCE_CLASS: ActivityClass = {
  id: 'cls-arm',
  userId: 'user-1',
  name: 'Upper body',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-04-07T06:00:00Z',
};

const LOAD_RISK_SUMMARY: LoadRiskSummary = {
  weekDays: [
    { date: '2026-05-22', flagged: true },
    { date: '2026-05-23', flagged: false },
    { date: '2026-05-24', flagged: true },
    { date: '2026-05-25', flagged: false },
    { date: '2026-05-26', flagged: false },
    { date: '2026-05-27', flagged: false },
    { date: '2026-05-28', flagged: false },
  ],
  classBars: [
    {
      activityClassId: 'cls-foot',
      className: 'Foot load',
      actual: 8,
      limit: 10,
      unit: 'km',
      exercises: [
        {
          activityId: 'act-walk',
          activityName: 'Walking',
          actual: 5,
          limit: 6,
          unit: 'km',
        },
      ],
    },
  ],
};

function setupDashboardWithLoadRisk(
  loadRiskSummary: LoadRiskSummary | null,
): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = DAILY_SCORES;
  mockEngine.previousBlocks = [];
  mockEngine.activityClasses = [FOOT_PERFORMANCE_CLASS];
  mockEngine.graphClassId = 'cls-foot';
  mockEngine.hasCheckedInToday = true;
  mockEngine.loadRiskSummary = loadRiskSummary;
}

function assertAppearsAfter(earlier: HTMLElement, later: HTMLElement): void {
  expect(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

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

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

function renderDashboard() {
  return renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
    />,
  );
}

describe('DashboardScreen — BlockSafetyMapSection: active block heatmap', () => {
  it('renders a CalendarHeatmap for the active block without firing a useQuery for that block id', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByTestId('calendar-heatmap')).toBeInTheDocument();

    const reviewCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return (
        Array.isArray(queryKey) &&
        queryKey[0] === 'block-review' &&
        queryKey[1] === ACTIVE_BLOCK.id
      );
    });
    expect(reviewCalls).toHaveLength(0);
  });
});

describe('DashboardScreen — BlockSafetyMapSection: one page per previous block', () => {
  it('calls useQuery for each previous block keyed ["block-review", block.id]', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1, PREV_BLOCK_2];

    useQueryMock.mockReturnValue(makeUseQuerySuccess({ dailyScores: [] }));

    renderDashboard();

    const reviewCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return Array.isArray(queryKey) && queryKey[0] === 'block-review';
    });
    const fetchedIds = reviewCalls.map((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown>;
      const queryKey = opts.queryKey as unknown[];
      return queryKey[1];
    });

    expect(fetchedIds).toContain(PREV_BLOCK_1.id);
    expect(fetchedIds).toContain(PREV_BLOCK_2.id);
  });
});

describe('DashboardScreen — BlockSafetyMapSection: loading skeleton', () => {
  it('shows a loading skeleton while a previous-block query is pending', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = [];
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryPending());

    renderDashboard();

    const skeleton =
      screen.queryByTestId('block-review-loading') ??
      screen.queryByTestId('block-scores-loading') ??
      screen.queryByRole('status') ??
      screen.queryByText(/loading/i) ??
      document.querySelector('[aria-busy="true"]') ??
      document.querySelector('.skeleton') ??
      document.querySelector('[data-loading]');

    expect(skeleton).not.toBeNull();
  });
});

describe('DashboardScreen — BlockSafetyMapSection: error state', () => {
  it('shows an error state with a retry button when a previous-block query fails', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [PREV_BLOCK_1];

    useQueryMock.mockReturnValue(makeUseQueryError());

    renderDashboard();

    const errorEl =
      screen.queryByText(/error|failed|could not load/i) ??
      screen.queryByRole('alert');
    expect(errorEl).not.toBeNull();

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

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

    expect(
      screen.queryByTestId('block-safety-map-scroll'),
    ).not.toBeInTheDocument();

    expect(screen.queryByTestId('calendar-heatmap')).not.toBeInTheDocument();
  });
});

describe('DashboardScreen — F10.1 recovery streaks section', () => {
  it('renders a Recovery streaks section below Last 7 days with daily and weekly copy', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.recoveryStreaks = [DAILY_RECOVERY_STREAK, WEEKLY_RECOVERY_STREAK];

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const weeklyLabel = screen.getByText('Last 7 days');
    const recoveryLabel = screen.getByText('Recovery streaks');
    assertAppearsAfter(weeklyLabel, recoveryLabel);

    expect(screen.getByText(/Stretching: 4 days in a row/i)).toBeInTheDocument();
    expect(screen.getByText(/Contrast therapy: 2 weeks in a row/i)).toBeInTheDocument();
  });

  it('shows compact empty copy when recoveryStreaks is empty on an active block', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.recoveryStreaks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Recovery streaks')).toBeInTheDocument();
    expect(
      screen.getByText(/No recovery targets in this block/i),
    ).toBeInTheDocument();
  });

  it('keeps recovery streaks separate from the clean streak section', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.recoveryStreaks = [DAILY_RECOVERY_STREAK];
    mockEngine.cleanStreak = 3;

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Recovery streaks')).toBeInTheDocument();
    expect(screen.getByText('Clean streak')).toBeInTheDocument();
    expect(screen.getByText(/Stretching: 4 days in a row/i)).toBeInTheDocument();
    expect(screen.getByText(/3 clean sessions in a row/i)).toBeInTheDocument();
  });
});

describe('DashboardScreen — F10.2 clean streak relabel', () => {
  it('renders the clean streak section with Clean streak heading and StreakRow copy', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.cleanStreak = 5;

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Clean streak')).toBeInTheDocument();
    expect(screen.getByText(/5 clean sessions in a row/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No rule violations or reported bad sessions/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('shows zero clean sessions copy when cleanStreak is 0', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.cleanStreak = 0;

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Clean streak')).toBeInTheDocument();
    expect(screen.getByText(/0 clean sessions in a row/i)).toBeInTheDocument();
  });
});

describe('DashboardScreen — F10.5 load graph title (engine.graphClassId / B10.2)', () => {
  it('uses the activity class name for graphClassId, not first performance class by ID sort', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.activityClasses = [ARM_PERFORMANCE_CLASS, FOOT_PERFORMANCE_CLASS];
    mockEngine.graphClassId = 'cls-foot';
    mockEngine.hasCheckedInToday = true;

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Foot load')).toBeInTheDocument();
    expect(screen.queryByText('Upper body')).not.toBeInTheDocument();
  });

  it('shows Weekly load when graphClassId is null', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.activityClasses = [FOOT_PERFORMANCE_CLASS];
    mockEngine.graphClassId = null;

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Weekly load')).toBeInTheDocument();
    expect(screen.queryByText('Foot load')).not.toBeInTheDocument();
  });

  it('shows Unknown class when graphClassId is not in activityClasses', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.activityClasses = [ARM_PERFORMANCE_CLASS];
    mockEngine.graphClassId = 'cls-foot';

    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText('Unknown class')).toBeInTheDocument();
  });
});

describe('DashboardScreen — Load risk visual panel (engine.loadRiskSummary)', () => {
  it('renders Load risk after the load graph with week strip and class bars', () => {
    setupDashboardWithLoadRisk(LOAD_RISK_SUMMARY);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const section = screen.getByTestId('load-risk-section');
    const blockSafetyLabel = screen.getByText('Block Safety Map');

    expect(section).toBeInTheDocument();
    assertAppearsAfter(section, blockSafetyLabel);

    expect(screen.getByTestId('load-risk-week-strip')).toBeInTheDocument();
    expect(screen.getByTestId('load-risk-class-bars')).toBeInTheDocument();
    expect(screen.getByText('8 / 10 km')).toBeInTheDocument();
  });

  it('highlights flagged days on the week strip', () => {
    setupDashboardWithLoadRisk(LOAD_RISK_SUMMARY);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const strip = screen.getByTestId('load-risk-week-strip');
    const flagged = strip.querySelectorAll('[data-flagged="true"]');
    expect(flagged.length).toBeGreaterThanOrEqual(2);
  });

  it('shows no-caps copy when loadRiskSummary is null', () => {
    setupDashboardWithLoadRisk(null);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText(/no load caps configured/i)).toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-week-strip')).not.toBeInTheDocument();
  });
});

describe('DashboardScreen — S25.F2 Goals card', () => {
  function setupDashboardWithGoalRows(goalRows: GoalDashboardRow[]): void {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.hasCheckedInToday = true;
    assignGoalRows(goalRows);
  }

  it('renders GoalsCard below Last 7 days when engine.goalRows has entries', () => {
    setupDashboardWithGoalRows([
      goalDashboardRowNumeric,
      goalDashboardRowQualitative,
      goalDashboardRowAchieved,
    ]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const weeklyLabel = screen.getByText('Last 7 days');
    const goalsCard = screen.getByTestId('goals-card');
    assertAppearsAfter(weeklyLabel, goalsCard);

    expect(screen.getByText(goalDashboardRowNumeric.title)).toBeInTheDocument();
    expect(screen.getByText(goalDashboardRowQualitative.title)).toBeInTheDocument();
    expect(screen.getByText(goalDashboardRowAchieved.title)).toBeInTheDocument();
  });

  it('hides GoalsCard when engine.goalRows is empty', () => {
    setupDashboardWithGoalRows([goalDashboardRowNumeric]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    const view = renderDashboard();
    expect(screen.getByTestId('goals-card')).toBeInTheDocument();

    assignGoalRows([]);
    view.rerender(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('goals-card')).not.toBeInTheDocument();
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
  });

  it('shows numeric fill bar width from fill_ratio on dashboard rows', () => {
    setupDashboardWithGoalRows([goalDashboardRowNumeric]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowNumeric.goalId}`);
    const bar = within(row).getByRole('progressbar');
    const fill = bar.querySelector<HTMLElement>('[style*="width"]');
    expect(fill?.style.width).toBe('40%');
  });

  it('shows qualitative status pill instead of a progress bar', () => {
    setupDashboardWithGoalRows([goalDashboardRowQualitative]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowQualitative.goalId}`);
    expect(within(row).getByTestId('goals-card-status-pill')).toHaveTextContent(/active/i);
    expect(within(row).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders achieved goals with subdued row styling', () => {
    setupDashboardWithGoalRows([goalDashboardRowAchieved]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowAchieved.goalId}`);
    expect(row).toHaveAttribute('data-achieved', 'true');
    expect(row.className).toMatch(/opacity-|text-ink-muted|text-ink-faint/);
  });
});

describe('DashboardScreen — BlockSafetyMapSection: only active block rendered', () => {
  it('renders exactly one CalendarHeatmap (the active block) when previousBlocks is empty', () => {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];

    useQueryMock.mockReturnValue(makeUseQuerySuccess([]));

    renderDashboard();

    const heatmaps = screen.getAllByTestId('calendar-heatmap');
    expect(heatmaps).toHaveLength(1);

    const reviewCalls = useQueryMock.mock.calls.filter((args: unknown[]) => {
      const opts = args[0] as Record<string, unknown> | undefined;
      const queryKey = opts?.queryKey as unknown[] | undefined;
      return Array.isArray(queryKey) && queryKey[0] === 'block-review';
    });
    expect(reviewCalls).toHaveLength(0);
  });
});
