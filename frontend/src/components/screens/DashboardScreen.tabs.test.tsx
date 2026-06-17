import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  applyC63DashboardFixtures,
  c63MobilityClass,
  c63SafeStretchSuggestion,
  c63StretchActivity,
  mockEngine,
  resetMockEngine,
} from '../../test/mockEngine';
import { goalDashboardRowNumeric } from '../../test/goalDashboardRowFixtures';
import type {
  ActivityClass,
  ActivityClassStatus,
  LoadPoint,
  LoadRiskSummary,
  TrainingBlock,
} from '../../types';
import type { WeeklyProgress } from '../../lib/engine';
import { DashboardScreen } from './DashboardScreen';

const DASHBOARD_TAB_STORAGE_KEY = 'milestone.dashboard.activeTab';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: ({ startDate, endDate }: { startDate: string; endDate: string }) => (
    <div data-testid="calendar-heatmap" data-start={startDate} data-end={endDate} />
  ),
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

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-dashboard-tabs',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

const FOOT_CLASS: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const FOOT_STATUS: ActivityClassStatus = {
  activityClassId: FOOT_CLASS.id,
  state: 'caution',
  label: 'Pushing it',
  lastDoneDate: '2026-06-11',
  nextSafeDate: '2026-06-14',
  reason: '1 more rest day recommended.',
};

const WEEKLY_PROGRESS_ROW: WeeklyProgress = {
  weeklyTargetId: 'wt-walk',
  activityClassId: FOOT_CLASS.id,
  className: 'Foot load',
  activityName: 'Walking',
  value: 2,
  target: 4,
  unit: 'sessions',
  state: 'neutral',
  periodStart: '2026-06-08',
  periodEnd: '2026-06-14',
};

const LOAD_RISK_SUMMARY: LoadRiskSummary = {
  weekDays: [
    { date: '2026-06-08', flagged: false, state: 'safe' },
    { date: '2026-06-09', flagged: true, state: 'caution' },
    { date: '2026-06-10', flagged: false, state: 'safe' },
    { date: '2026-06-11', flagged: false, state: 'safe' },
    { date: '2026-06-12', flagged: false, state: 'safe' },
    { date: '2026-06-13', flagged: false, state: 'safe' },
    { date: '2026-06-14', flagged: false, state: 'safe' },
  ],
  ruleLimitRows: [
    {
      id: 'row-foot-weekly',
      scope: 'class',
      ruleId: 'rule-foot-weekly',
      ruleType: 'weekly_volume_cap',
      activityClassId: FOOT_CLASS.id,
      className: FOOT_CLASS.name,
      actual: 8,
      limit: 10,
      unit: 'km',
      state: 'caution',
      label: 'Foot load weekly volume',
      displayMode: 'bar',
    },
  ],
};

const LOAD_SERIES: LoadPoint[] = [
  { date: '2026-06-12', load: 4, dailyLoad: 4 },
  { date: '2026-06-13', load: 6, dailyLoad: 2 },
  { date: '2026-06-14', load: 8, dailyLoad: 2 },
];

function makeUseQuerySuccess() {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function resetDashboardTabPreference(): void {
  window.localStorage.removeItem(DASHBOARD_TAB_STORAGE_KEY);
}

function setupDashboardTabsEngine(): void {
  mockEngine.todayDate = '2026-06-14';
  mockEngine.userName = 'Sam';
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.hasCheckedInToday = false;
  applyC63DashboardFixtures({ suggestionBuckets: [c63SafeStretchSuggestion] });
  mockEngine.activityClasses = [FOOT_CLASS, c63MobilityClass];
  mockEngine.weeklyProgress = [WEEKLY_PROGRESS_ROW];
  mockEngine.goalRows = [goalDashboardRowNumeric];
  mockEngine.classStatuses = [FOOT_STATUS];
  mockEngine.loadRiskSummary = LOAD_RISK_SUMMARY;
  mockEngine.loadSeries = LOAD_SERIES;
  mockEngine.graphClassId = FOOT_CLASS.id;
  mockEngine.weekLoadThreshold = 10;
  mockEngine.dailyScores = [
    { date: '2026-06-12', state: 'safe', violations: [], hadFlareUp: false },
    { date: '2026-06-13', state: 'caution', violations: [], hadFlareUp: false },
  ];
  mockEngine.previousBlocks = [];
}

function renderDashboard(callbacks: {
  onOpenCheckIn?: () => void;
  onOpenLogActivity?: (activityId?: string) => void;
  onQuickLog?: (activity: typeof c63StretchActivity) => void;
  onViewGoals?: () => void;
  onViewSettings?: () => void;
} = {}) {
  return renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={callbacks.onOpenCheckIn ?? vi.fn()}
      onOpenLogActivity={callbacks.onOpenLogActivity ?? vi.fn()}
      onQuickLog={callbacks.onQuickLog}
      onViewGoals={callbacks.onViewGoals}
      onViewSettings={callbacks.onViewSettings}
    />,
  );
}

async function chooseDashboardTab(name: 'Today' | 'Metrics' | 'Safety'): Promise<void> {
  await userEvent.click(screen.getByRole('radio', { name }));
}

beforeEach(() => {
  resetDashboardTabPreference();
  useQueryMock.mockReturnValue(makeUseQuerySuccess());
});

afterEach(() => {
  cleanup();
  resetDashboardTabPreference();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('DashboardScreen dashboard tabs', () => {
  it('renders Today, Metrics, and Safety as the only dashboard tab choices', () => {
    setupDashboardTabsEngine();

    renderDashboard();

    const tabs = screen.getByRole('radiogroup', { name: /dashboard tabs/i });
    expect(within(tabs).getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
    expect(within(tabs).getByRole('radio', { name: 'Metrics' })).toHaveAttribute('aria-checked', 'false');
    expect(within(tabs).getByRole('radio', { name: 'Safety' })).toHaveAttribute('aria-checked', 'false');
    expect(within(tabs).getAllByRole('radio')).toHaveLength(3);
  });

  it('defaults to Today with daily actions and no Metrics or Safety section bleed', () => {
    setupDashboardTabsEngine();

    renderDashboard();

    expect(screen.getByText(/Good morning, Sam/i)).toBeInTheDocument();
    expect(screen.getByText('Morning check-in')).toBeInTheDocument();
    expect(screen.getByText('Suggested for today')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-today-load-risk-indicator')).toBeInTheDocument();

    expect(screen.queryByText('This week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('goals-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calendar-heatmap')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity status')).not.toBeInTheDocument();
  });

  it('reports high load risk on Today when danger comes from week-day history, even if rule rows are not danger', async () => {
    setupDashboardTabsEngine();
    mockEngine.loadRiskSummary = {
      ...LOAD_RISK_SUMMARY,
      weekDays: LOAD_RISK_SUMMARY.weekDays.map((day, index) =>
        index === 3 ? { ...day, flagged: true, state: 'danger' } : day,
      ),
      ruleLimitRows: LOAD_RISK_SUMMARY.ruleLimitRows.map((row) => ({
        ...row,
        state: 'caution',
      })),
    };

    renderDashboard();

    const todayIndicator = screen.getByTestId('dashboard-today-load-risk-indicator');
    expect(todayIndicator).toHaveTextContent('High load risk');
    expect(todayIndicator.className).toMatch(/danger/);

    await chooseDashboardTab('Safety');

    expect(screen.getByTestId('load-risk-guidance-strip')).toHaveAttribute('data-state', 'danger');
  });

  it('shows only weekly targets and goals on the Metrics tab', async () => {
    setupDashboardTabsEngine();

    renderDashboard();
    await chooseDashboardTab('Metrics');

    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(screen.getByText('Walking')).toBeInTheDocument();
    expect(screen.getByTestId('goals-card')).toBeInTheDocument();
    expect(screen.getByText(goalDashboardRowNumeric.title)).toBeInTheDocument();

    expect(screen.queryByText(/Good morning, Sam/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Morning check-in')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggested for today')).not.toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-section')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity status')).not.toBeInTheDocument();
  });

  it('shows only graph, load risk, block safety map, and activity status on the Safety tab', async () => {
    setupDashboardTabsEngine();

    renderDashboard();
    await chooseDashboardTab('Safety');

    expect(screen.getByRole('heading', { name: FOOT_CLASS.name })).toBeInTheDocument();
    expect(screen.getByTestId('load-risk-section')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-heatmap')).toBeInTheDocument();
    expect(screen.getByText('Activity status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /foot load/i })).toBeInTheDocument();

    expect(screen.queryByText(/Good morning, Sam/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Morning check-in')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggested for today')).not.toBeInTheDocument();
    expect(screen.queryByText('This week')).not.toBeInTheDocument();
    expect(screen.queryByTestId('goals-card')).not.toBeInTheDocument();
  });

  it('persists the active dashboard tab across remounts', async () => {
    setupDashboardTabsEngine();

    renderDashboard();
    await chooseDashboardTab('Safety');

    expect(window.localStorage.getItem(DASHBOARD_TAB_STORAGE_KEY)).toBe('safety');

    cleanup();
    setupDashboardTabsEngine();
    renderDashboard();

    expect(screen.getByRole('radio', { name: 'Safety' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Activity status')).toBeInTheDocument();
    expect(screen.queryByText('Suggested for today')).not.toBeInTheDocument();
  });

  it('defaults corrupt stored tab values back to Today', () => {
    window.localStorage.setItem(DASHBOARD_TAB_STORAGE_KEY, 'yesterday');
    setupDashboardTabsEngine();

    renderDashboard();

    expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Suggested for today')).toBeInTheDocument();
    expect(screen.queryByText('Activity status')).not.toBeInTheDocument();
  });

  it('keeps Today callbacks wired through the tab component', async () => {
    const onOpenCheckIn = vi.fn();
    const onOpenLogActivity = vi.fn();
    const onQuickLog = vi.fn();
    setupDashboardTabsEngine();

    renderDashboard({ onOpenCheckIn, onOpenLogActivity, onQuickLog });

    await userEvent.click(screen.getByRole('button', { name: /complete morning check-in/i }));
    await userEvent.click(screen.getByRole('button', { name: /log stretching/i }));

    expect(onOpenCheckIn).toHaveBeenCalledTimes(1);
    expect(onQuickLog).toHaveBeenCalledTimes(1);
    expect(onQuickLog).toHaveBeenCalledWith(c63StretchActivity);
    expect(onOpenLogActivity).not.toHaveBeenCalled();
  });
});

describe('DashboardScreen tab component boundary', () => {
  it('delegates dashboard tab contents to page-local screen components', () => {
    const screenDir = 'src/components/screens';
    const source = readFileSync(`${screenDir}/DashboardScreen.tsx`, 'utf8');

    for (const componentName of [
      'DashboardTodayTab',
      'DashboardMetricsTab',
      'DashboardSafetyTab',
    ]) {
      expect(existsSync(`${screenDir}/${componentName}.tsx`)).toBe(true);
      expect(source).toContain(componentName);
    }

    expect(source).toContain('SegmentedControl');
    expect(source).not.toContain("from '../composites/SuggestedActivityCard'");
    expect(source).not.toContain("from '../composites/WeeklyLoadGraph'");
    expect(source).not.toContain("from '../composites/LoadRiskSection'");
    expect(source).not.toContain("from '../composites/BlockSafetyMapSection'");
    expect(source).not.toContain("from '../composites/GoalsCard'");
  });

  it('keeps Today load-risk state sourced from shared summary interpretation', () => {
    const source = readFileSync('src/components/screens/DashboardTodayTab.tsx', 'utf8');

    expect(source).not.toContain('ruleLimitRows.some');
    expect(source).not.toContain('weekDays.some');
  });
});
