/**
 * UX-A3 — Activity status: this-week sessions + units
 *
 * Tests that DashboardScreen renders the Activity Status section correctly
 * after the UX-A3 changes.
 *
 * These tests FAIL before the UX-A3 implementation exists because:
 *   - DashboardScreen still renders `cs.reason` (recency text) as the single
 *     secondary line, not a session-count string.
 *   - No "sessions this week" text is produced.
 *   - No per-class weekly session/unit data is threaded through the engine.
 *
 * Acceptance criteria covered:
 *   AC-A  No recency string ("0 days ago", "Last done today", "days ago") appears
 *         in the Activity Status section.
 *   AC-B  Each row with sessions > 0 shows units beside the class title
 *         (e.g. "Gentle walk · 5 km").
 *   AC-C  Each safe/clear row shows exactly one secondary line:
 *         "{n} session(s) this week".
 *   AC-D  Caution/danger rows show the violation reason as the secondary line
 *         (not session count).
 *   AC-E  Zero sessions: secondary line reads "0 sessions this week";
 *         no unit appended to title.
 *   AC-F  Mixed units: secondary line is session count only; no unit beside title.
 *   AC-G  Singular: "1 session this week" vs plural: "3 sessions this week".
 *   AC-H  StatusDot traffic-light state and nextSafeDate summary unchanged.
 *
 * Mocking strategy: same pattern as DashboardScreen.uxA1.test.tsx.
 * `engine` is provided as a prop; `mockEngine` is mutated per test.
 * `classWeeklySummaries` is the new field the implementer must add to the engine.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { DashboardScreen } from './DashboardScreen';
import type { TrainingBlock, ActivityClass, ActivityClassStatus } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';

// ---------------------------------------------------------------------------
// Shared mocks — same pattern as other DashboardScreen test files
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

const safeWalkStatus: ActivityClassStatus = {
  activityClassId: 'cls-walk',
  state: 'safe',
  label: 'Safe',
  lastDoneDate: '2026-06-10',
  // reason contains the old recency string; UX-A3 must no longer render it as the secondary line
  reason: 'Last done 2 days ago.',
};

const dangerWalkStatus: ActivityClassStatus = {
  activityClassId: 'cls-walk',
  state: 'danger',
  label: 'Resting',
  lastDoneDate: '2026-06-12',
  nextSafeDate: '2026-06-14',
  reason: 'Too soon — 2 more rest days needed. Safe from 2026-06-14.',
};

const cautionWalkStatus: ActivityClassStatus = {
  activityClassId: 'cls-walk',
  state: 'caution',
  label: 'Pushing it',
  lastDoneDate: '2026-06-11',
  nextSafeDate: '2026-06-14',
  reason: '1 more rest day recommended. Safe from 2026-06-14.',
};

// The new shape the implementer must add to MilestoneEngineResult and compute
// in useMilestoneEngine (or lib/engine.ts):
//
//   classWeeklySummaries: ClassWeeklySummary[]
//
// where ClassWeeklySummary = {
//   activityClassId: string;
//   sessionCount: number;
//   totalVolume: number | null;
//   volumeUnit: VolumeUnit | null;
// }

type ClassWeeklySummary = {
  activityClassId: string;
  sessionCount: number;
  totalVolume: number | null;
  volumeUnit: string | null;
};

type EngineWithWeeklySummaries = MilestoneEngineResult & {
  classWeeklySummaries: ClassWeeklySummary[];
};

function setWeeklySummaries(summaries: ClassWeeklySummary[]): void {
  (mockEngine as EngineWithWeeklySummaries).classWeeklySummaries = summaries;
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

function setupBase() {
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.dailyScores = [];
  mockEngine.previousBlocks = [];
  mockEngine.activityClasses = [walkClass];
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

// ---------------------------------------------------------------------------
// AC-A  No recency strings ("days ago", "Last done today") in Activity Status
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-A: no recency strings in Activity Status', () => {
  it('does not render "days ago" anywhere in the Activity Status section', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 5, volumeUnit: 'km' }]);

    renderDashboard();

    // "days ago" is the fingerprint of the old recency text
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/days ago/i);
  });

  it('does not render "Last done" anywhere in the Activity Status section', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 1, totalVolume: 3, volumeUnit: 'km' }]);

    renderDashboard();

    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/Last done/i);
  });
});

// ---------------------------------------------------------------------------
// AC-B  Units beside the class title (e.g. "Gentle walk · 5 km")
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-B: units beside the class title', () => {
  it('shows units beside the class title when sessions > 0 and single unit', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 5, volumeUnit: 'km' }]);

    renderDashboard();

    // The implementation must render something like "Gentle walk · 5 km"
    // (exact separator may vary but class name and volume must appear together)
    expect(screen.getByText(/Gentle walk/)).toBeInTheDocument();
    expect(screen.getByText(/5\s*km/)).toBeInTheDocument();
  });

  it('does NOT show units beside the title when session count is zero', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 0, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    // "0 km" must not appear anywhere in the document
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/0\s*km/);
  });
});

// ---------------------------------------------------------------------------
// AC-C  Safe/clear rows: secondary line is "{n} session(s) this week"
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-C: safe row secondary line is session count', () => {
  it('shows "2 sessions this week" as the secondary line for a safe class', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 5, volumeUnit: 'km' }]);

    renderDashboard();

    expect(screen.getByText(/2 sessions this week/i)).toBeInTheDocument();
  });

  it('shows "0 sessions this week" for a safe class with no sessions this week', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 0, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    expect(screen.getByText(/0 sessions this week/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-D  Caution/danger rows: show violation reason, not session count
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-D: caution/danger rows show violation reason', () => {
  it('shows the violation reason (not session count) for a danger-state row', () => {
    setupBase();
    mockEngine.classStatuses = [dangerWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 1, totalVolume: 3, volumeUnit: 'km' }]);

    renderDashboard();

    // Violation reason must appear
    expect(screen.getByText(/Too soon/i)).toBeInTheDocument();

    // Session count must NOT appear as the secondary line for caution/danger rows
    expect(screen.queryByText(/1 session this week/i)).not.toBeInTheDocument();
  });

  it('shows the violation reason (not session count) for a caution-state row', () => {
    setupBase();
    mockEngine.classStatuses = [cautionWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 6, volumeUnit: 'km' }]);

    renderDashboard();

    expect(screen.getByText(/1 more rest day recommended/i)).toBeInTheDocument();
    expect(screen.queryByText(/2 sessions this week/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-E  Zero sessions: "0 sessions this week"; no "0 km"
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-E: zero-session edge case', () => {
  it('renders "0 sessions this week" for a class with no logs this week', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 0, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    expect(screen.getByText(/0 sessions this week/i)).toBeInTheDocument();
  });

  it('does not render "0 km" when sessionCount is 0', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 0, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/0\s*km/);
  });
});

// ---------------------------------------------------------------------------
// AC-F  Mixed units: session count only, no title unit
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-F: mixed-unit class shows session count only', () => {
  it('shows session count but not a volume unit when volumeUnit is null (mixed)', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    expect(screen.getByText(/2 sessions this week/i)).toBeInTheDocument();
    // No volume unit should appear alongside the class title
    const allText = document.body.textContent ?? '';
    expect(allText).not.toMatch(/Gentle walk\s*[·•]\s*\d+\s*(km|min|minutes|m\b)/);
  });
});

// ---------------------------------------------------------------------------
// AC-G  Singular: "1 session this week" vs plural: "3 sessions this week"
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-G: singular and plural session strings', () => {
  it('renders "1 session this week" (singular) for exactly one session', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 1, totalVolume: 4, volumeUnit: 'km' }]);

    renderDashboard();

    expect(screen.getByText(/^1 session this week$/i)).toBeInTheDocument();
    // Must NOT say "1 sessions this week"
    expect(screen.queryByText(/^1 sessions this week$/i)).not.toBeInTheDocument();
  });

  it('renders "3 sessions this week" (plural) for three sessions', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 3, totalVolume: 9, volumeUnit: 'km' }]);

    renderDashboard();

    expect(screen.getByText(/^3 sessions this week$/i)).toBeInTheDocument();
  });

  it('renders "0 sessions this week" (plural) for zero', () => {
    setupBase();
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 0, totalVolume: null, volumeUnit: null }]);

    renderDashboard();

    expect(screen.getByText(/^0 sessions this week$/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-H  StatusDot and nextSafeDate summary are unchanged
// ---------------------------------------------------------------------------

describe('DashboardScreen — UX-A3 AC-H: StatusDot and nextSafeDate unchanged', () => {
  it('still renders the "Safe <date>" chip when nextSafeDate present on a danger row', () => {
    setupBase();
    mockEngine.classStatuses = [dangerWalkStatus]; // has nextSafeDate: '2026-06-14'
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 1, totalVolume: 3, volumeUnit: 'km' }]);

    renderDashboard();

    // The "Safe Jun 14" (or similar short date) chip must still appear.
    // The current implementation renders: <span className="text-caption ...">Safe {formatShort(nextSafeDate)}</span>
    // We match "Safe <Month> <day>" — there may be multiple matches (chip + reason text), so use queryAllByText.
    const safeDateMatches = screen.queryAllByText(/Safe \w+ \d+/i);
    expect(safeDateMatches.length).toBeGreaterThan(0);
  });

  it('does not render a "Safe <date>" chip when nextSafeDate is absent on a safe row', () => {
    setupBase();
    // safeWalkStatus has no nextSafeDate
    mockEngine.classStatuses = [safeWalkStatus];
    setWeeklySummaries([{ activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 5, volumeUnit: 'km' }]);

    renderDashboard();

    // No "Safe Jun 14" style text should appear when there is no nextSafeDate
    // This regex matches "Safe" followed by a month name and date — the date chip pattern
    expect(screen.queryByText(/Safe \w+ \d+/i)).not.toBeInTheDocument();
  });

  it('multiple classes each get their own session count row', () => {
    const strengthClass: ActivityClass = {
      id: 'cls-strength',
      userId: 'user-1',
      name: 'Strength',
      type: 'performance',
      defaultRecoveryWindowDays: 2,
      createdAt: '2026-01-01T00:00:00Z',
    };
    const strengthStatus: ActivityClassStatus = {
      activityClassId: 'cls-strength',
      state: 'safe',
      label: 'Safe',
      reason: 'No restrictions.',
    };

    setupBase();
    mockEngine.activityClasses = [walkClass, strengthClass];
    mockEngine.classStatuses = [safeWalkStatus, strengthStatus];
    setWeeklySummaries([
      { activityClassId: 'cls-walk', sessionCount: 2, totalVolume: 5, volumeUnit: 'km' },
      { activityClassId: 'cls-strength', sessionCount: 1, totalVolume: null, volumeUnit: null },
    ]);

    renderDashboard();

    // Both classes must show their own session count
    expect(screen.getByText(/2 sessions this week/i)).toBeInTheDocument();
    expect(screen.getByText(/1 session this week/i)).toBeInTheDocument();
    // Both class names present
    expect(screen.getByText(/Gentle walk/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength/i)).toBeInTheDocument();
  });
});
