/**
 * Remove Clean Streak section from Dashboard
 *
 * AC coverage:
 *   1. Dashboard renders with no Clean Streak card / section heading.
 *   2. Dashboard renders with no StreakRow content (session count phrase, subtitle text).
 *   3. cleanStreak field is still present on MilestoneEngineResult type (compile-time check).
 *   4. Remaining key Dashboard sections still render (no regression).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { DashboardScreen } from './DashboardScreen';

// ---------------------------------------------------------------------------
// Mock CalendarHeatmap (same pattern as DashboardScreen.test.tsx)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DashboardTab = 'today' | 'metrics' | 'safety';

function makeUseQuerySuccess(data: unknown) {
  return {
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

function renderDashboard(tab: DashboardTab = 'today') {
  const view = renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
    />,
  );
  if (tab === 'today') {
    fireEvent.click(screen.getByRole('radio', { name: 'Today' }));
  }
  if (tab === 'metrics') {
    fireEvent.click(screen.getByRole('radio', { name: 'Metrics' }));
  }
  if (tab === 'safety') {
    fireEvent.click(screen.getByRole('radio', { name: 'Safety' }));
  }
  return view;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC 1 & 2 — No streak section visible (cleanStreak = 5, non-zero)
// ---------------------------------------------------------------------------

describe('Clean Streak section removed from Dashboard', () => {
  it('does not render a "Clean streak" section heading when cleanStreak is non-zero', () => {
    mockEngine.cleanStreak = 5;
    mockEngine.previousBlocks = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard('metrics');

    expect(screen.queryByText('Clean streak')).not.toBeInTheDocument();
  });

  it('does not render StreakRow session-count copy when cleanStreak is non-zero', () => {
    mockEngine.cleanStreak = 5;
    mockEngine.previousBlocks = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard('metrics');

    // StreakRow renders "{count} clean session{s} in a row"
    expect(screen.queryByText(/clean sessions in a row/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/clean session in a row/i)).not.toBeInTheDocument();
  });

  it('does not render StreakRow subtitle text when cleanStreak is non-zero', () => {
    mockEngine.cleanStreak = 5;
    mockEngine.previousBlocks = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(
      screen.queryByText(/No rule violations or reported bad sessions/i),
    ).not.toBeInTheDocument();
  });

  it('does not render "Clean streak" section heading when cleanStreak is 0', () => {
    mockEngine.cleanStreak = 0;
    mockEngine.previousBlocks = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.queryByText('Clean streak')).not.toBeInTheDocument();
  });

  it('does not render StreakRow copy when cleanStreak is 0', () => {
    mockEngine.cleanStreak = 0;
    mockEngine.previousBlocks = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.queryByText(/clean sessions in a row/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC 3 — cleanStreak still exists on the engine result type (compile-time)
// ---------------------------------------------------------------------------

describe('cleanStreak field still present on MilestoneEngineResult', () => {
  it('cleanStreak is a numeric field on MilestoneEngineResult (type-level check)', () => {
    // This is a compile-time check: if the field is removed from the type,
    // the TypeScript assignment below will fail at `tsc --noEmit`.
    const result: MilestoneEngineResult = mockEngine;
    const streak: number = result.cleanStreak;
    // Value sanity to prevent the variable being optimised away by the linter.
    expect(typeof streak).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Key Dashboard sections still present (no regression)
// ---------------------------------------------------------------------------

describe('Remaining Dashboard sections unaffected', () => {
  it('renders the greeting header', () => {
    mockEngine.previousBlocks = [];
    mockEngine.userName = 'Sam';
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard();

    expect(screen.getByText(/Good morning, Sam/i)).toBeInTheDocument();
  });

  it('renders the This week section', () => {
    mockEngine.previousBlocks = [];
    mockEngine.weeklyProgress = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard('metrics');

    expect(screen.getByText('This week')).toBeInTheDocument();
  });

  it('renders the Activity status section', () => {
    mockEngine.previousBlocks = [];
    mockEngine.classStatuses = [];
    useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));

    renderDashboard('safety');

    expect(screen.getByText('Activity status')).toBeInTheDocument();
  });
});
