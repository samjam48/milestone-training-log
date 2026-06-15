/**
 * Activity status expandable rule detail
 *
 * These tests describe the ticket acceptance criteria without adding engine or
 * API fields. The detail panel must use ActivityClassStatus.reason and derive
 * rest days remaining from nextSafeDate minus engine.todayDate.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { DashboardScreen } from './DashboardScreen';
import type { ActivityClass, ActivityClassStatus, TrainingBlock } from '../../types';

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
  id: 'blk-active',
  userId: 'user-1',
  name: 'Test Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

const walkClass: ActivityClass = {
  id: 'cls-walk',
  userId: 'user-1',
  name: 'Gentle walk',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const strengthClass: ActivityClass = {
  id: 'cls-strength',
  userId: 'user-1',
  name: 'Strength',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const DANGER_WALK_REASON = 'Too soon — 2 more rest days needed. Safe from 2026-06-14.';
const CAUTION_STRENGTH_REASON = '1 more rest day recommended. Safe from 2026-06-13.';
const SAFE_WALK_REASON = 'Ready for normal loading.';

const dangerWalkStatus: ActivityClassStatus = {
  activityClassId: walkClass.id,
  state: 'danger',
  label: 'Resting',
  lastDoneDate: '2026-06-11',
  nextSafeDate: '2026-06-14',
  reason: DANGER_WALK_REASON,
};

const cautionStrengthStatus: ActivityClassStatus = {
  activityClassId: strengthClass.id,
  state: 'caution',
  label: 'Pushing it',
  lastDoneDate: '2026-06-10',
  nextSafeDate: '2026-06-13',
  reason: CAUTION_STRENGTH_REASON,
};

const safeWalkStatus: ActivityClassStatus = {
  activityClassId: walkClass.id,
  state: 'safe',
  label: 'Safe',
  lastDoneDate: '2026-06-09',
  reason: SAFE_WALK_REASON,
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

function setupBase(): void {
  mockEngine.todayDate = '2026-06-12';
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  mockEngine.weeklyProgress = [];
  mockEngine.loadSeries = [];
  mockEngine.activityClasses = [walkClass, strengthClass];
  mockEngine.classWeeklySummaries = [
    { activityClassId: walkClass.id, sessionCount: 1, totalVolume: 4, volumeUnit: 'km' },
    { activityClassId: strengthClass.id, sessionCount: 1, totalVolume: null, volumeUnit: null },
  ];
  useQueryMock.mockReturnValue(makeUseQuerySuccess(undefined));
}

function renderDashboard() {
  const view = renderWithProviders(
    <DashboardScreen
      engine={mockEngine}
      onOpenCheckIn={vi.fn()}
      onOpenLogActivity={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Safety' }));
  return view;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('DashboardScreen — activity status expandable detail', () => {
  it('expands a row into an inline detail panel and collapses it when tapped again', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.classStatuses = [dangerWalkStatus];

    renderDashboard();

    const walkRow = screen.getByRole('button', { name: /gentle walk/i });
    expect(walkRow).toHaveAttribute('aria-expanded', 'false');
    expect(within(walkRow).getByRole('status')).toBeInTheDocument();

    await user.click(walkRow);

    expect(walkRow).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(DANGER_WALK_REASON)).toBeInTheDocument();
    expect(screen.getByText(/2\s+(?:rest\s+)?days?\s+(?:remaining|until safe)/i)).toBeInTheDocument();
    expect(screen.getByText(/safe jun 14/i)).toBeInTheDocument();

    await user.click(walkRow);

    expect(walkRow).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/2\s+(?:rest\s+)?days?\s+(?:remaining|until safe)/i)).not.toBeInTheDocument();
  });

  it('keeps only one activity status row expanded at a time', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.classStatuses = [dangerWalkStatus, cautionStrengthStatus];

    renderDashboard();

    const walkRow = screen.getByRole('button', { name: /gentle walk/i });
    const strengthRow = screen.getByRole('button', { name: /strength/i });

    await user.click(walkRow);
    expect(walkRow).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/2\s+(?:rest\s+)?days?\s+(?:remaining|until safe)/i)).toBeInTheDocument();

    await user.click(strengthRow);

    expect(walkRow).toHaveAttribute('aria-expanded', 'false');
    expect(strengthRow).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText(/2\s+(?:rest\s+)?days?\s+(?:remaining|until safe)/i)).not.toBeInTheDocument();
    expect(screen.getByText(CAUTION_STRENGTH_REASON)).toBeInTheDocument();
    expect(screen.getByText(/1\s+(?:rest\s+)?day\s+(?:remaining|until safe)/i)).toBeInTheDocument();
  });

  it('shows only the reason for a safe class with no next safe date', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];

    renderDashboard();

    await user.click(screen.getByRole('button', { name: /gentle walk/i }));

    expect(screen.getByText(SAFE_WALK_REASON)).toBeInTheDocument();
    expect(screen.queryByText(/days?\s+(?:remaining|until safe)/i)).not.toBeInTheDocument();
  });

  it('clamps days remaining to zero when nextSafeDate is before todayDate', async () => {
    const user = userEvent.setup();
    setupBase();
    mockEngine.todayDate = '2026-06-15';
    mockEngine.classStatuses = [dangerWalkStatus];

    renderDashboard();

    await user.click(screen.getByRole('button', { name: /gentle walk/i }));

    expect(screen.getByText(DANGER_WALK_REASON)).toBeInTheDocument();
    expect(screen.getByText(/0\s+(?:rest\s+)?days?\s+(?:remaining|until safe)/i)).toBeInTheDocument();
    expect(screen.queryByText(/-\d+\s+(?:rest\s+)?days?/i)).not.toBeInTheDocument();
  });
});
