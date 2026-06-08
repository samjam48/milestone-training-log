/**
 * WTL.F3 — Dashboard weekly target suggestion copy (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F3
 *
 * Covers dashboard wiring for target-driven Do cards, completed-target absence,
 * calm empty Do copy, and rest override messaging.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { TrainingBlock } from '../../types';
import {
  WTL_F3_ACTIVITY_BIKE,
  WTL_F3_ACTIVITY_WALK,
  WTL_F3_AS_OF,
  WTL_F3_CLASS_FOOT,
  wtlF3AllTargetsCompleteBuckets,
  wtlF3AllTargetsCompleteProgress,
  wtlF3BikeDoIncomplete,
  wtlF3OnlyBikeDoBuckets,
  wtlF3WalkDoIncomplete,
  wtlF3WalkDoneLoggedToday,
  wtlF3WalkRestOverride,
} from '../../test/wtlF3SuggestionFixtures';
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
  id: 'blk-wtl-f3',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
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

function setupDashboardSuggestions(
  suggestionBuckets: typeof mockEngine.suggestionBuckets,
  options: {
    weeklyProgress?: typeof mockEngine.weeklyProgress;
    todayDate?: string;
  } = {},
): void {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  mockEngine.recoveryStreaks = [];
  mockEngine.activityClasses = [WTL_F3_CLASS_FOOT];
  mockEngine.activities = [WTL_F3_ACTIVITY_WALK, WTL_F3_ACTIVITY_BIKE];
  mockEngine.suggestionBuckets = suggestionBuckets;
  mockEngine.weeklyProgress = options.weeklyProgress ?? [];
  mockEngine.todayDate = options.todayDate ?? WTL_F3_AS_OF;
  mockEngine.hasCheckedInToday = true;
}

function suggestionCardRoot(): HTMLElement {
  const title = screen.getByText('Suggested for today');
  const card = title.closest('.rounded-lg') as HTMLElement | null;
  if (card == null) {
    throw new Error('Expected SuggestedActivityCard root');
  }
  return card;
}

function suggestionDoSection(): HTMLElement {
  return screen.getByTestId('suggestion-section-do');
}

function suggestionRestSection(): HTMLElement {
  return screen.getByTestId('suggestion-section-rest');
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

beforeEach(() => {
  useQueryMock.mockReturnValue(makeUseQuerySuccess());
});

describe('DashboardScreen — WTL.F3 weekly target Do suggestions', () => {
  it('renders target-driven Do cards with activity name and remaining weekly amount', () => {
    setupDashboardSuggestions([wtlF3WalkDoIncomplete, wtlF3BikeDoIncomplete]);

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    const section = suggestionDoSection();
    expect(within(section).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(section).getByText(/3\.5 km left this week/i)).toBeInTheDocument();
    expect(within(section).getByText('Stationary Bike')).toBeInTheDocument();
    expect(within(section).getByText(/35 minutes left this week/i)).toBeInTheDocument();
  });

  it('keeps completed weekly targets out of Do on the dashboard', () => {
    setupDashboardSuggestions(wtlF3OnlyBikeDoBuckets);

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    const section = suggestionDoSection();
    expect(within(section).getByText('Stationary Bike')).toBeInTheDocument();
    expect(within(section).queryByText('Morning Walk')).not.toBeInTheDocument();
  });

  it('does not render noisy Done cards for completed targets unless logged today', () => {
    setupDashboardSuggestions(wtlF3OnlyBikeDoBuckets);

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('suggestion-section-done')).not.toBeInTheDocument();
  });

  it('shows Done today when a target activity was logged today', () => {
    setupDashboardSuggestions([
      wtlF3WalkDoneLoggedToday,
      wtlF3BikeDoIncomplete,
    ]);

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    expect(screen.getByTestId('suggestion-section-done')).toBeInTheDocument();
    expect(within(suggestionDoSection()).queryByText('Morning Walk')).not.toBeInTheDocument();
  });
});

describe('DashboardScreen — WTL.F3 calm empty Do copy', () => {
  it('shows calm weekly-target-complete copy when all targets are met and Do is empty', () => {
    setupDashboardSuggestions(wtlF3AllTargetsCompleteBuckets, {
      weeklyProgress: wtlF3AllTargetsCompleteProgress,
    });

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    const card = suggestionCardRoot();
    expect(
      within(card).getByText(/weekly targets met for this week/i),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/nothing to suggest yet/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/you're done for today/i)).not.toBeInTheDocument();
  });
});

describe('DashboardScreen — WTL.F3 rest override copy', () => {
  it('prioritizes safety rule copy in Rest over weekly target pressure', () => {
    setupDashboardSuggestions([wtlF3WalkRestOverride]);

    renderWithProviders(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );

    const rest = suggestionRestSection();
    expect(within(rest).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(rest).getByText(/too soon after the last session/i)).toBeInTheDocument();
    expect(within(rest).queryByText(/left this week/i)).not.toBeInTheDocument();
    expect(within(suggestionDoSection()).queryByText('Morning Walk')).not.toBeInTheDocument();
  });
});
