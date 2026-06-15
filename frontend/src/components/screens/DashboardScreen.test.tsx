/**
 * F3.0-fix — DashboardScreen: BlockSafetyMapSection inline tests.
 * B10.4 — previous-block fetches use getTrainingBlockReview (/review), not /scores.
 * F10.1 — Dashboard recovery streaks section (plans/tickets-phase-10-polish-2026-06-04.md).
 * F10.2 — Dashboard clean streak relabel (plans/tickets-phase-10-polish-2026-06-04.md).
 * Load-risk panel removed from dashboard (owner feedback 2026-06-04); delayed tax kept on incident/check-in flows.
 * F10.5 — Load graph title from engine.graphClassId (plans/tickets-phase-10-polish-2026-06-04.md).
 * S25.F2 — Goals dashboard card (plans/tickets-stage-2-5-usage-logic-2026-06-06.md).
 * WTL.F1 — This Week weekly progress card (plans/tickets-weekly-targets-load-risk-2026-06-07.md).
 * WTL.F6 — Remove Recovery streaks dashboard section (plans/tickets-weekly-targets-load-risk-2026-06-07.md).
 *
 * Mocking strategy (mirrors BlockReviewScreen.test.tsx):
 *   - CalendarHeatmap: stubbed to a simple div — tests verify screen wiring, not heatmap internals
 *   - @tanstack/react-query useQuery: mocked via vi.hoisted + vi.mock to control per-block states
 *   - getTrainingBlockReview: mocked via vi.mock on the trainingBlocks module
 *   - DashboardScreen receives engine directly as a prop
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, screen, cleanup, within } from '@testing-library/react';
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
import {
  WTL_F1_PERIOD_END,
  WTL_F1_PERIOD_START,
  activityScopedWeeklyProgress,
  completeWeeklyProgress,
  legacyClassWeeklyProgress,
  overCompleteWeeklyProgress,
  type WeeklyProgressWtlF1,
} from '../../test/wtlF1WeeklyProgressFixtures';
import type { WeeklyProgress } from '../../lib/engine';
import { DashboardScreen } from './DashboardScreen';

type EngineWithGoalRows = MilestoneEngineResult & { goalRows: GoalDashboardRow[] };
type DashboardTab = 'today' | 'metrics' | 'safety';

let dashboardTab: DashboardTab = 'today';

function assignGoalRows(rows: GoalDashboardRow[]): void {
  (mockEngine as EngineWithGoalRows).goalRows = rows;
}

function useDashboardTab(tab: DashboardTab): void {
  dashboardTab = tab;
}

function dashboardTabLabel(tab: DashboardTab): 'Today' | 'Metrics' | 'Safety' {
  if (tab === 'metrics') return 'Metrics';
  if (tab === 'safety') return 'Safety';
  return 'Today';
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
    { date: '2026-05-22', flagged: true, state: 'caution' },
    { date: '2026-05-23', flagged: false, state: 'safe' },
    { date: '2026-05-24', flagged: true, state: 'caution' },
    { date: '2026-05-25', flagged: false, state: 'safe' },
    { date: '2026-05-26', flagged: false, state: 'safe' },
    { date: '2026-05-27', flagged: false, state: 'safe' },
    { date: '2026-05-28', flagged: false, state: 'safe' },
  ],
  ruleLimitRows: [
    {
      id: 'row-foot-km',
      scope: 'class',
      ruleId: 'rule-foot-km',
      ruleType: 'weekly_volume_cap',
      activityClassId: 'cls-foot',
      className: 'Foot load',
      actual: 8,
      limit: 10,
      unit: 'km',
      state: 'safe',
      label: 'Foot load weekly volume',
      displayMode: 'bar',
    },
    {
      id: 'row-walk-km',
      scope: 'activity',
      ruleId: 'rule-walk-km',
      ruleType: 'weekly_volume_cap',
      activityClassId: 'cls-foot',
      className: 'Foot load',
      activityId: 'act-walk',
      activityName: 'Walking',
      actual: 5,
      limit: 6,
      unit: 'km',
      state: 'caution',
      label: 'Walking weekly volume',
      displayMode: 'bar',
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
  dashboardTab = 'today';
  resetMockEngine();
  vi.clearAllMocks();
});

function renderDashboard() {
  const view = renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
    />,
  );
  if (dashboardTab !== 'today') {
    fireEvent.click(screen.getByRole('radio', { name: dashboardTabLabel(dashboardTab) }));
  }
  return view;
}

function setupDashboardWeeklyProgress(
  weeklyProgress: WeeklyProgressWtlF1[],
  options: { todayDate?: string } = {},
): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = DAILY_SCORES;
  mockEngine.previousBlocks = [];
  mockEngine.recoveryStreaks = [];
  mockEngine.weeklyProgress = weeklyProgress as WeeklyProgress[];
  if (options.todayDate != null) {
    mockEngine.todayDate = options.todayDate;
  }
}

function weeklyProgressSection(): HTMLElement {
  const heading = screen.getByText('This week');
  const section = heading.closest('div');
  if (section == null) {
    throw new Error('Expected weekly progress section wrapper');
  }
  return section;
}

function progressBarFillForLabel(label: string): HTMLElement | null {
  const labelEl = within(weeklyProgressSection()).getByText(label);
  const barRoot = labelEl.closest('.w-full');
  return barRoot?.querySelector<HTMLElement>('[role="progressbar"] > div') ?? null;
}

describe('DashboardScreen — BlockSafetyMapSection: active block heatmap', () => {
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
  beforeEach(() => {
    useDashboardTab('safety');
  });

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

/**
 * WTL.F6 implementer: record a future recovery-streak feature in plans/BACKLOG.md
 * (weekly-target completion history, not the retired dashboard section).
 */
const recoveryWeeklyTargetProgress: WeeklyProgressWtlF1 = {
  weeklyTargetId: 'wt-wtl-contrast',
  activityClassId: 'cls-recovery',
  className: 'Recovery',
  activityId: 'act-contrast',
  activityName: 'Contrast therapy',
  value: 2,
  target: 3,
  unit: 'sessions',
  state: 'safe',
  periodStart: WTL_F1_PERIOD_START,
  periodEnd: WTL_F1_PERIOD_END,
};

function setupDashboardWtlF6(options: {
  recoveryStreaks?: RecoveryStreak[];
  weeklyProgress?: WeeklyProgressWtlF1[];
  cleanStreak?: number;
} = {}): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = DAILY_SCORES;
  mockEngine.previousBlocks = [];
  mockEngine.recoveryStreaks = options.recoveryStreaks ?? [];
  mockEngine.weeklyProgress = (options.weeklyProgress ?? []) as WeeklyProgress[];
  if (options.cleanStreak != null) {
    mockEngine.cleanStreak = options.cleanStreak;
  }
}

describe('DashboardScreen — WTL.F6 remove recovery streaks section', () => {
  beforeEach(() => {
    useDashboardTab('metrics');
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));
  });

  it('does not render a Recovery streaks section when recoveryStreaks has entries', () => {
    setupDashboardWtlF6({
      recoveryStreaks: [DAILY_RECOVERY_STREAK, WEEKLY_RECOVERY_STREAK],
    });

    renderDashboard();

    expect(screen.queryByText('Recovery streaks')).not.toBeInTheDocument();
    expect(screen.queryByText(/Stretching: 4 days in a row/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contrast therapy: 2 weeks in a row/i)).not.toBeInTheDocument();
  });

  it('does not show No recovery targets in this block empty copy', () => {
    setupDashboardWtlF6({ recoveryStreaks: [] });

    renderDashboard();

    expect(screen.queryByText('Recovery streaks')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No recovery targets in this block/i),
    ).not.toBeInTheDocument();
  });

  it('shows recovery weekly targets in the This week section as progress bars', () => {
    setupDashboardWtlF6({
      recoveryStreaks: [WEEKLY_RECOVERY_STREAK],
      weeklyProgress: [recoveryWeeklyTargetProgress],
    });

    renderDashboard();

    const section = weeklyProgressSection();
    expect(within(section).getByText('Contrast therapy')).toBeInTheDocument();
    expect(within(section).getByText(/2 sessions \/ 3 sessions/i)).toBeInTheDocument();
    expect(screen.queryByText(/Contrast therapy: 2 weeks in a row/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery streaks')).not.toBeInTheDocument();
  });

  it('does not show clean streak section or recovery streaks when recoveryStreaks has entries (UX-A4)', () => {
    setupDashboardWtlF6({
      recoveryStreaks: [DAILY_RECOVERY_STREAK],
      cleanStreak: 3,
    });

    renderDashboard();

    expect(screen.queryByText('Clean streak')).not.toBeInTheDocument();
    expect(screen.queryByText(/3 clean sessions in a row/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery streaks')).not.toBeInTheDocument();
    expect(screen.queryByText(/Stretching: 4 days in a row/i)).not.toBeInTheDocument();
  });
});

describe('DashboardScreen — F10.5 load graph title (engine.graphClassId / B10.2)', () => {
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
  beforeEach(() => {
    useDashboardTab('safety');
  });

  it('renders Load risk after the load graph with week strip and rule rows', () => {
    setupDashboardWithLoadRisk(LOAD_RISK_SUMMARY);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const section = screen.getByTestId('load-risk-section');
    const loadGraphHeading = screen.getByRole('heading', { name: 'Foot load' });

    expect(section).toBeInTheDocument();
    assertAppearsAfter(loadGraphHeading, section);

    expect(screen.getByTestId('load-risk-week-strip')).toBeInTheDocument();
    expect(screen.getByTestId('load-risk-rule-rows')).toBeInTheDocument();
    expect(screen.getByText('Weekly: 8 / 10 km')).toBeInTheDocument();
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
  beforeEach(() => {
    useDashboardTab('metrics');
  });

  function setupDashboardWithGoalRows(goalRows: GoalDashboardRow[]): void {
    mockEngine.block = ACTIVE_BLOCK;
    mockEngine.dailyScores = DAILY_SCORES;
    mockEngine.previousBlocks = [];
    mockEngine.hasCheckedInToday = true;
    assignGoalRows(goalRows);
  }

  it('renders GoalsCard below This week when engine.goalRows has entries', () => {
    setupDashboardWithGoalRows([
      goalDashboardRowNumeric,
      goalDashboardRowQualitative,
      goalDashboardRowAchieved,
    ]);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const weeklyLabel = screen.getByText('This week');
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

describe('DashboardScreen — WTL.F1 This Week weekly progress card', () => {
  beforeEach(() => {
    useDashboardTab('metrics');
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));
  });

  it('labels the weekly targets section This week instead of Last 7 days', () => {
    setupDashboardWeeklyProgress([]);
    renderDashboard();

    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.queryByText('Last 7 days')).not.toBeInTheDocument();
  });

  it('shows an info card when no weekly targets are configured', () => {
    setupDashboardWeeklyProgress([]);
    renderDashboard();

    expect(
      within(weeklyProgressSection()).getByTestId('weekly-targets-empty-state'),
    ).toBeInTheDocument();
  });

  it('shows activity names for activity-scoped targets and class names for legacy targets', () => {
    setupDashboardWeeklyProgress([
      activityScopedWeeklyProgress,
      legacyClassWeeklyProgress,
    ]);
    renderDashboard();

    const section = weeklyProgressSection();
    expect(within(section).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(section).getByText('WTL Foot Load')).toBeInTheDocument();
    expect(within(section).queryAllByText('WTL Foot Load')).toHaveLength(1);
  });

  it('shows the Monday–Sunday period instead of rolling seven-day copy', () => {
    setupDashboardWeeklyProgress([activityScopedWeeklyProgress], {
      todayDate: WTL_F1_PERIOD_END,
    });
    renderDashboard();

    const section = weeklyProgressSection();
    expect(within(section).queryByText(/last 7 days/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/rolling/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/past 7/i)).not.toBeInTheDocument();
    expect(within(section).getByText(/Jun 1.*Jun 7/i)).toBeInTheDocument();
  });

  it('renders a met minimum target as safe, not danger', () => {
    setupDashboardWeeklyProgress([completeWeeklyProgress]);
    renderDashboard();

    const fill = progressBarFillForLabel('Stationary Bike');
    expect(fill).not.toBeNull();
    expect(fill?.className).toMatch(/bg-safe/);
    expect(fill?.className).not.toMatch(/bg-danger/);
  });

  it('does not render an over-complete minimum target as danger', () => {
    setupDashboardWeeklyProgress([overCompleteWeeklyProgress]);
    renderDashboard();

    const fill = progressBarFillForLabel('Morning Walk');
    expect(fill).not.toBeNull();
    expect(fill?.className).toMatch(/bg-safe/);
    expect(fill?.className).not.toMatch(/bg-danger/);
    expect(fill?.className).not.toMatch(/bg-caution/);
  });
});

describe('DashboardScreen — BlockSafetyMapSection: only active block rendered', () => {
  beforeEach(() => {
    useDashboardTab('safety');
  });

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
