/**
 * F3.0-fix — DashboardScreen: BlockSafetyMapSection inline tests.
 * B10.4 — previous-block fetches use getTrainingBlockReview (/review), not /scores.
 * F10.1 — Dashboard recovery streaks section (plans/tickets-phase-10-polish-2026-06-04.md).
 * F10.2 — Dashboard clean streak relabel (plans/tickets-phase-10-polish-2026-06-04.md).
 * F10.3 — Dashboard delayed-tax / load-risk panel (plans/tickets-phase-10-polish-2026-06-04.md).
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
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass, TrainingBlock, DailySafetyScore, RecoveryStreak } from '../../types';
import { DashboardScreen } from './DashboardScreen';

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

const DELAYED_TAX_BASE: Omit<DelayedTaxResponse, 'hits'> = {
  asOf: '2026-05-28',
  riskWindowDays: 7,
  baselineDays: 14,
  painThreshold: 3,
};

const PROACTIVE_ONLY_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [
    {
      hitType: 'elevated_load',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-22',
      message: 'Foot load on May 22 was above your 14-day baseline',
    },
    {
      hitType: 'rest_debt',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-24',
      message: 'Back-to-back foot sessions without enough rest',
    },
  ],
};

const SYMPTOM_LINKED_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [
    {
      hitType: 'symptom_marker',
      activityClassId: 'cls-foot',
      symptomDate: '2026-05-23',
      message: 'Pain or flare recorded on May 23',
    },
    {
      hitType: 'acute_attribution',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-20',
      symptomDate: '2026-05-22',
      primary: true,
      message: 'Return session after 14 days off, symptoms within 3 days',
    },
    {
      hitType: 'symptom_contributor',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-21',
      symptomDate: '2026-05-23',
      contributorHitType: 'elevated_load',
      message: 'Earlier elevated load in the week before symptoms',
    },
  ],
};

const EMPTY_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [],
};

function setupDashboardWithDelayedTax(
  delayedTax: DelayedTaxResponse | undefined,
): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = DAILY_SCORES;
  mockEngine.previousBlocks = [];
  mockEngine.activityClasses = [FOOT_PERFORMANCE_CLASS];
  mockEngine.hasCheckedInToday = true;
  mockEngine.delayedTax = delayedTax;
}

function getLoadRiskSectionRoot(): HTMLElement {
  const label = screen.getByText('Load risk');
  const section = label.parentElement;
  expect(section).not.toBeNull();
  return section!;
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

describe('DashboardScreen — F10.3 load-risk panel (engine.delayedTax / H10.1)', () => {
  it('renders Load risk after the load graph and before Block Safety Map', () => {
    setupDashboardWithDelayedTax(PROACTIVE_ONLY_DELAYED_TAX);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const loadGraphTitle = screen.getByText('Foot load');
    const loadRiskLabel = screen.getByText('Load risk');
    const blockSafetyLabel = screen.getByText('Block Safety Map');

    assertAppearsAfter(loadGraphTitle, loadRiskLabel);
    assertAppearsAfter(loadRiskLabel, blockSafetyLabel);
  });

  it('lists proactive elevated_load and rest_debt hits with class name and contributing date', () => {
    setupDashboardWithDelayedTax(PROACTIVE_ONLY_DELAYED_TAX);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const section = getLoadRiskSectionRoot();
    expect(
      within(section).getByText(/Foot load on May 22 was above your 14-day baseline/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Back-to-back foot sessions without enough rest/i),
    ).toBeInTheDocument();
    expect(within(section).getByText(/May 22/i)).toBeInTheDocument();
    expect(within(section).getByText(/May 24/i)).toBeInTheDocument();
  });

  it('uses caution Card styling when proactive hits are present', () => {
    setupDashboardWithDelayedTax(PROACTIVE_ONLY_DELAYED_TAX);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const section = getLoadRiskSectionRoot();
    expect(section.querySelector('.bg-caution-bg')).not.toBeNull();
  });

  it('shows distinct symptom-linked attribution copy for marker, acute, and contributor hits', () => {
    setupDashboardWithDelayedTax(SYMPTOM_LINKED_DELAYED_TAX);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    const section = getLoadRiskSectionRoot();
    expect(within(section).getByText(/Pain or flare recorded on May 23/i)).toBeInTheDocument();
    expect(
      within(section).getByText(/Return session after 14 days off, symptoms within 3 days/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Earlier elevated load in the week before symptoms/i),
    ).toBeInTheDocument();
  });

  it('shows compact safe copy when delayedTax has no hits', () => {
    setupDashboardWithDelayedTax(EMPTY_DELAYED_TAX);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(
      screen.getByText(/No elevated load or rest-debt flags in the last 7 days/i),
    ).toBeInTheDocument();
  });

  it('omits load-risk hit copy while delayedTax is undefined (query still pending)', () => {
    setupDashboardWithDelayedTax(undefined);
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText('Block Safety Map')).toBeInTheDocument();
    expect(screen.queryByText('Load risk')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No elevated load or rest-debt flags/i),
    ).not.toBeInTheDocument();
  });

  it('caps visible proactive hits at five with an overflow summary', () => {
    const manyHits = Array.from({ length: 7 }, (_, index) => ({
      hitType: 'elevated_load' as const,
      activityClassId: 'cls-foot',
      contributingDate: `2026-05-${String(10 + index).padStart(2, '0')}`,
      message: `Elevated load flag ${index + 1}`,
    }));
    setupDashboardWithDelayedTax({ ...DELAYED_TAX_BASE, hits: manyHits });
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText(/and 2 more/i)).toBeInTheDocument();
    expect(screen.queryByText('Elevated load flag 7')).not.toBeInTheDocument();
  });

  it('falls back to Unknown class when activityClassId is not in activityClasses', () => {
    setupDashboardWithDelayedTax({
      ...DELAYED_TAX_BASE,
      hits: [
        {
          hitType: 'elevated_load',
          activityClassId: 'cls-missing',
          contributingDate: '2026-05-22',
          message: 'Load spike on May 22',
        },
      ],
    });
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText(/Unknown class/i)).toBeInTheDocument();
    expect(screen.getByText(/May 22/i)).toBeInTheDocument();
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
