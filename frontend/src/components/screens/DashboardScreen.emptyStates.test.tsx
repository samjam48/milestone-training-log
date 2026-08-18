/**
 * Actionable empty-state cards (DashboardScreen)
 *
 * These tests describe expected behavior:
 *   - The weekly-targets empty branch currently renders a plain muted text node
 *     ("No weekly targets configured."), not an info Card with a CTA.
 *   - The Activity Status section has no empty-state card at all when classStatuses
 *     is empty — the list simply renders nothing.
 *   - No `onViewGoals` or `onViewSettings` callback props exist on DashboardScreen.
 *
 * Acceptance criteria covered:
 *
 *   AC-1  Weekly-targets empty state: info card rendered when weeklyProgress is empty.
 *   AC-2  Weekly-targets CTA: clicking it calls onViewGoals.
 *   AC-3  Weekly-targets CTA: hidden (not a dead button) when onViewGoals is not provided.
 *   AC-4  Weekly-targets non-empty: no CTA rendered (existing progress bars shown instead).
 *
 *   AC-5  Activity Status empty state: info card rendered when classStatuses is empty.
 *   AC-6  Activity Status CTA: clicking it calls onViewSettings.
 *   AC-7  Activity Status CTA: hidden when onViewSettings is not provided.
 *   AC-8  Activity Status non-empty: no empty-state card rendered when classStatuses has rows.
 *
 *   AC-9  Copy is product-voiced — no "configured" or "blocks" jargon in empty-state text.
 *
 * Mocking strategy: same pattern as DashboardScreen.checkInCompletionBadge.test.tsx.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { DashboardScreen } from './DashboardScreen';
import type { TrainingBlock, ActivityClass, ActivityClassStatus } from '../../types';
import type { WeeklyProgress } from '../../lib/engine';

// ---------------------------------------------------------------------------
// Shared mocks — same pattern as DashboardScreen.checkInCompletionBadge.test.tsx
// ---------------------------------------------------------------------------

type DashboardTab = 'today' | 'metrics' | 'safety';

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'Test Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const ACTIVITY_CLASS: ActivityClass = {
  id: 'cls-walk',
  userId: 'user-1',
  name: 'Gentle Walk',
  type: 'performance',
  defaultRecoveryWindowDays: 1,
  loadWeight: 1,
  createdAt: '2026-04-01T00:00:00Z',
};

const CLASS_STATUS_SAFE: ActivityClassStatus = {
  activityClassId: ACTIVITY_CLASS.id,
  state: 'safe',
  label: 'Safe',
  reason: 'Within recovery window.',
  lastDoneDate: '2026-05-27',
};

const WEEKLY_PROGRESS_ROW: WeeklyProgress = {
  weeklyTargetId: 'wt-1',
  activityClassId: ACTIVITY_CLASS.id,
  className: 'Gentle Walk',
  value: 2,
  target: 3,
  unit: 'sessions',
  state: 'neutral',
  periodStart: '2026-05-26',
  periodEnd: '2026-06-01',
};

function makeUseQuerySuccess(data: unknown) {
  return {
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

interface RenderOptions {
  onViewGoals?: () => void;
  onViewSettings?: () => void;
  tab?: DashboardTab;
}

function renderDashboard(opts: RenderOptions = {}) {
  const view = renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
      onViewGoals={opts.onViewGoals}
      onViewSettings={opts.onViewSettings}
    />,
  );
  if (opts.tab === 'metrics') {
    fireEvent.click(screen.getByRole('radio', { name: 'Metrics' }));
  }
  if (opts.tab === 'safety') {
    fireEvent.click(screen.getByRole('radio', { name: 'Safety' }));
  }
  return view;
}

function setupBase() {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  mockEngine.weeklyProgress = [];
  mockEngine.classStatuses = [];
  mockEngine.activityClasses = [];
  useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC-1 – AC-4: Weekly targets empty state
// ---------------------------------------------------------------------------

describe('DashboardScreen — weekly targets empty state', () => {
  it('AC-1: shows an info card in the This week section when weeklyProgress is empty', () => {
    setupBase();
    mockEngine.weeklyProgress = [];

    renderDashboard({ onViewGoals: vi.fn(), tab: 'metrics' });

    // The old fallback text must not appear as the sole content
    // A new empty-state element must be present in the weekly targets slot
    const emptyStateCard = screen.getByTestId('weekly-targets-empty-state');
    expect(emptyStateCard).toBeInTheDocument();
  });

  it('AC-2: clicking the Goals CTA in the weekly targets empty state calls onViewGoals', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.weeklyProgress = [];
    const onViewGoals = vi.fn();

    renderDashboard({ onViewGoals, tab: 'metrics' });

    const cta = screen.getByRole('button', { name: /set up.*goals|add.*goal|go to goals|view goals/i });
    await user.click(cta);

    expect(onViewGoals).toHaveBeenCalledTimes(1);
  });

  it('AC-3: Goals CTA is not rendered when onViewGoals is not provided', () => {
    setupBase();
    mockEngine.weeklyProgress = [];

    // No onViewGoals prop — CTA must be absent, not a dead button
    renderDashboard({ tab: 'metrics' });

    // Empty state card may still show, but there must be no clickable CTA button
    // targeting Goals that would be dead
    expect(
      screen.queryByRole('button', { name: /set up.*goals|add.*goal|go to goals|view goals/i }),
    ).not.toBeInTheDocument();
  });

  it('AC-4: no empty-state card shown when weeklyProgress has rows (progress bars render instead)', () => {
    setupBase();
    mockEngine.weeklyProgress = [WEEKLY_PROGRESS_ROW];
    mockEngine.activityClasses = [ACTIVITY_CLASS];

    renderDashboard({ onViewGoals: vi.fn(), tab: 'metrics' });

    expect(screen.queryByTestId('weekly-targets-empty-state')).not.toBeInTheDocument();
    // Progress bar for the row must be present
    expect(screen.getByText('Gentle Walk')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5 – AC-8: Activity Status empty state
// ---------------------------------------------------------------------------

describe('DashboardScreen — activity status empty state', () => {
  it('AC-5: shows an info card in the Activity Status section when classStatuses is empty', () => {
    setupBase();
    mockEngine.classStatuses = [];

    renderDashboard({ onViewSettings: vi.fn(), tab: 'safety' });

    const emptyStateCard = screen.getByTestId('activity-status-empty-state');
    expect(emptyStateCard).toBeInTheDocument();
  });

  it('AC-6: clicking the Settings CTA in the activity status empty state calls onViewSettings', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.classStatuses = [];
    const onViewSettings = vi.fn();

    renderDashboard({ onViewSettings, tab: 'safety' });

    const cta = screen.getByRole('button', { name: /go to settings|set up.*activit|open settings|add.*activit/i });
    await user.click(cta);

    expect(onViewSettings).toHaveBeenCalledTimes(1);
  });

  it('AC-7: Settings CTA is not rendered when onViewSettings is not provided', () => {
    setupBase();
    mockEngine.classStatuses = [];

    // No onViewSettings prop — CTA must be absent
    renderDashboard({ tab: 'safety' });

    expect(
      screen.queryByRole('button', { name: /go to settings|set up.*activit|open settings|add.*activit/i }),
    ).not.toBeInTheDocument();
  });

  it('AC-8: no empty-state card when classStatuses has at least one row', () => {
    setupBase();
    mockEngine.classStatuses = [CLASS_STATUS_SAFE];
    mockEngine.activityClasses = [ACTIVITY_CLASS];

    renderDashboard({ onViewSettings: vi.fn(), tab: 'safety' });

    expect(screen.queryByTestId('activity-status-empty-state')).not.toBeInTheDocument();
    // The row content must be visible
    expect(screen.getByText('Gentle Walk')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-9: Copy is product-voiced — no jargon
// ---------------------------------------------------------------------------

describe('DashboardScreen — empty-state copy quality', () => {
  it('AC-9a: weekly targets empty state contains no "configured" jargon', () => {
    setupBase();
    mockEngine.weeklyProgress = [];

    renderDashboard({ onViewGoals: vi.fn(), tab: 'metrics' });

    const emptyStateCard = screen.getByTestId('weekly-targets-empty-state');
    expect(emptyStateCard.textContent).not.toMatch(/configured/i);
  });

  it('AC-9b: activity status empty state contains no "configured" or "blocks" jargon', () => {
    setupBase();
    mockEngine.classStatuses = [];

    renderDashboard({ onViewSettings: vi.fn(), tab: 'safety' });

    const emptyStateCard = screen.getByTestId('activity-status-empty-state');
    expect(emptyStateCard.textContent).not.toMatch(/configured/i);
    expect(emptyStateCard.textContent).not.toMatch(/\bblocks\b/i);
  });
});
