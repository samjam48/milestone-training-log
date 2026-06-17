/**
 * Check-in completion badge
 *
 * Acceptance criteria:
 *   - hasCheckedInToday === true  → success Card with "Check-in complete" shown;
 *                                   CheckInCTA NOT shown.
 *   - hasCheckedInToday === false → CheckInCTA shown; success badge NOT shown.
 *   - hasCheckedInToday === undefined (engine still loading) → CTA shown (treat
 *                                   as not-checked-in), success badge NOT shown.
 *   - Both states occupy the same slot (no shift in surrounding sections).
 *   - No timestamp string like "Logged at 7:15 AM"; only "Logged today" if any
 *     secondary copy appears at all.
 *
 * These tests describe expected behavior.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { DashboardScreen } from './DashboardScreen';
import type { TrainingBlock } from '../../types';

// ---------------------------------------------------------------------------
// Shared mocks — same pattern as DashboardScreen.test.tsx
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
// Helpers
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

function setupBase() {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Check-in completion badge tests
// ---------------------------------------------------------------------------

describe('DashboardScreen — check-in completion badge', () => {
  it('shows a success-intent "Check-in complete" card when hasCheckedInToday is true', () => {
    setupBase();
    mockEngine.hasCheckedInToday = true;

    renderDashboard();

    // The success badge must be present
    expect(screen.getByText('Check-in complete')).toBeInTheDocument();
  });

  it('does NOT show the CheckInCTA when hasCheckedInToday is true', () => {
    setupBase();
    mockEngine.hasCheckedInToday = true;

    renderDashboard();

    // The CTA prompt must not appear
    expect(screen.queryByText('Morning check-in')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /complete morning check-in/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the CheckInCTA and NOT the success badge when hasCheckedInToday is false', () => {
    setupBase();
    mockEngine.hasCheckedInToday = false;

    renderDashboard();

    expect(screen.getByText('Morning check-in')).toBeInTheDocument();
    expect(screen.queryByText('Check-in complete')).not.toBeInTheDocument();
  });

  it('shows the CheckInCTA and NOT the success badge when hasCheckedInToday is undefined (loading)', () => {
    setupBase();
    // Simulate engine still loading — cast to bypass type check
    (mockEngine as { hasCheckedInToday: boolean | undefined }).hasCheckedInToday = undefined;

    renderDashboard();

    // CTA must appear (treat undefined as not checked in)
    expect(screen.getByText('Morning check-in')).toBeInTheDocument();
    // Success badge must never flash during loading
    expect(screen.queryByText('Check-in complete')).not.toBeInTheDocument();
  });

  it('does not show a timestamp string with a clock time when hasCheckedInToday is true', () => {
    setupBase();
    mockEngine.hasCheckedInToday = true;

    renderDashboard();

    // "Logged at HH:MM AM/PM" pattern is forbidden by the spec
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/Logged at \d/i);
  });

  it('surrounding Today sections do not shift in either check-in state', () => {
    setupBase();

    // Render with CTA state first
    mockEngine.hasCheckedInToday = false;
    const { rerender } = renderDashboard();
    expect(screen.getByText('Suggested for today')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-today-load-risk-indicator')).toBeInTheDocument();

    // Rerender with success badge state
    mockEngine.hasCheckedInToday = true;
    rerender(
      <DashboardScreen
        engine={mockEngine}
        onOpenCheckIn={vi.fn()}
        onOpenLogActivity={vi.fn()}
      />,
    );
    expect(screen.getByText('Suggested for today')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-today-load-risk-indicator')).toBeInTheDocument();
  });

  it('the success badge card has success/safe intent (not info)', () => {
    setupBase();
    mockEngine.hasCheckedInToday = true;

    renderDashboard();

    const badge = screen.getByText('Check-in complete').closest('[class*="bg-"]');
    expect(badge).not.toBeNull();
    // The Card with intent="success" or "safe" must carry the safe-bg class;
    // it must NOT carry the info-bg class that the CTA uses.
    expect(badge?.className).toMatch(/bg-safe/);
    expect(badge?.className).not.toMatch(/bg-info/);
  });

  it('the "Check-in complete" primary text carries typography classes matching the design system', () => {
    setupBase();
    mockEngine.hasCheckedInToday = true;

    renderDashboard();

    const el = screen.getByText('Check-in complete');
    expect(el.className).toMatch(/font-semibold/);
    expect(el.className).toMatch(/text-safe-fg/);
  });
});
