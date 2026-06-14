/**
 * UX-A10 — Load Risk: fix redundant bar-mode label and remove status rows.
 * plans/tickets-ux-overhaul-2026-06-12.md §UX-A10
 *
 * Acceptance criteria:
 *   AC-1  Class-scoped bar-mode row: ProgressBar label shows row.className, NOT row.label
 *   AC-2  Activity-scoped bar-mode row: ProgressBar label shows row.activityName (unchanged)
 *   AC-3  displayMode === 'status' rows are not rendered (return null / no DOM node)
 *   AC-4  valueText (right-side "Weekly: 1 / 3 sessions") is unchanged for bar-mode rows
 *   AC-5  data-testid, data-display-mode, data-scope, data-activity-id on bar-mode rows unchanged
 *   AC-6  A group containing ONLY status rows produces no class-group header in the DOM
 *   AC-7  A mixed group (bar + status rows) renders bar rows normally; only status rows are suppressed
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAFE_WEEK_DAYS: LoadRiskSummary['weekDays'] = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-06-0${i + 1}`,
  flagged: false,
  state: 'safe' as const,
}));

type Row = LoadRiskSummary['ruleLimitRows'][number];

function makeClassRow(overrides: Partial<Row> & Pick<Row, 'id'>): Row {
  return {
    scope: 'class',
    ruleId: 'rule-1',
    ruleType: 'weekly_volume_cap',
    activityClassId: 'cls-1',
    className: 'High-Intensity Foot Load',
    actual: 1,
    limit: 3,
    unit: 'sessions',
    state: 'safe',
    label: '1 / 3 sessions · High-Intensity Foot Load',
    displayMode: 'bar',
    ...overrides,
  };
}

function makeActivityRow(overrides: Partial<Row> & Pick<Row, 'id'>): Row {
  return {
    scope: 'activity',
    ruleId: 'rule-2',
    ruleType: 'weekly_volume_cap',
    activityClassId: 'cls-1',
    className: 'High-Intensity Foot Load',
    activityId: 'act-run',
    activityName: 'Running',
    actual: 5,
    limit: 10,
    unit: 'km',
    state: 'safe',
    label: '5 / 10 km · Running',
    displayMode: 'bar',
    ...overrides,
  };
}

function makeStatusRow(overrides: Partial<Row> & Pick<Row, 'id'>): Row {
  return {
    scope: 'class',
    ruleId: 'rule-3',
    ruleType: 'rest_between_class',
    activityClassId: 'cls-1',
    className: 'High-Intensity Foot Load',
    actual: 6,
    limit: 3,
    unit: 'days',
    state: 'safe',
    label: '6 days since last session (3-day minimum)',
    displayMode: 'status',
    ...overrides,
  };
}

function buildSummary(rows: Row[]): LoadRiskSummary {
  return { weekDays: SAFE_WEEK_DAYS, ruleLimitRows: rows };
}

// ---------------------------------------------------------------------------
// AC-1: Class-scoped bar-mode row uses className as the label, NOT row.label
// ---------------------------------------------------------------------------

describe('UX-A10 AC-1 — class-scoped bar-mode label shows className', () => {
  it('renders row.className as the label for a class-scoped bar-mode row', () => {
    const row = makeClassRow({ id: 'r1' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // className should appear as the label
    expect(screen.getByText('High-Intensity Foot Load')).toBeInTheDocument();
  });

  it('does NOT render the count-bearing label string for a class-scoped bar-mode row', () => {
    const row = makeClassRow({ id: 'r1' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // row.label ("1 / 3 sessions · High-Intensity Foot Load") must NOT appear as the left-side label.
    // The count portion "· High-Intensity Foot Load" combined with session count is the tell.
    // We check that the full label string is absent (it contains " · " which only appears in row.label).
    expect(screen.queryByText(/1 \/ 3 sessions · High-Intensity Foot Load/)).not.toBeInTheDocument();
  });

  it('renders className from a second distinct class-scoped row correctly', () => {
    const row = makeClassRow({
      id: 'r1b',
      className: 'Upper Body',
      label: '2 / 4 sessions · Upper Body',
      activityClassId: 'cls-upper',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText('Upper Body')).toBeInTheDocument();
    expect(screen.queryByText(/2 \/ 4 sessions · Upper Body/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Activity-scoped bar-mode row still uses activityName (unchanged)
// ---------------------------------------------------------------------------

describe('UX-A10 AC-2 — activity-scoped bar-mode label shows activityName', () => {
  it('renders row.activityName as the label for an activity-scoped bar-mode row', () => {
    const row = makeActivityRow({ id: 'r2' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('does NOT render the count-bearing label string for an activity-scoped row', () => {
    const row = makeActivityRow({ id: 'r2' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/5 \/ 10 km · Running/)).not.toBeInTheDocument();
  });

  it('handles activity-scoped row with null activityName gracefully (existing fallback)', () => {
    const row = makeActivityRow({ id: 'r2b', activityName: null });
    // Should not throw; the existing guard handles null activityName
    expect(() =>
      renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-3: displayMode === 'status' rows produce no DOM output
// ---------------------------------------------------------------------------

describe('UX-A10 AC-3 — status rows are not rendered', () => {
  it('renders no DOM node for a status-mode row', () => {
    const row = makeStatusRow({ id: 'r3' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // The row's data-testid must not be present in the DOM
    expect(
      screen.queryByTestId('load-risk-rule-row-r3'),
    ).not.toBeInTheDocument();
  });

  it('does not render the status row label text', () => {
    const row = makeStatusRow({ id: 'r3', label: '6 days since last session (3-day minimum)' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(
      screen.queryByText('6 days since last session (3-day minimum)'),
    ).not.toBeInTheDocument();
  });

  it('does not render "days since last session" text from any status row', () => {
    const row = makeStatusRow({ id: 'r3b', label: '2 days since last session (3-day minimum)' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/days since last session/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: valueText (right-side) is unchanged for bar-mode rows
// ---------------------------------------------------------------------------

describe('UX-A10 AC-4 — bar-mode valueText is unchanged', () => {
  it('shows "Weekly: 1 / 3 sessions" as the right-side valueText on a class-scoped bar row', () => {
    const row = makeClassRow({ id: 'r4' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/Weekly: 1 \/ 3 sessions/)).toBeInTheDocument();
  });

  it('shows "Weekly: 5 / 10 km" as the right-side valueText on an activity-scoped bar row', () => {
    const row = makeActivityRow({ id: 'r4b' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/Weekly: 5 \/ 10 km/)).toBeInTheDocument();
  });

  it('shows "Daily: ..." prefix for daily_volume_cap bar-mode rows', () => {
    const row = makeClassRow({ id: 'r4c', ruleType: 'daily_volume_cap' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/Daily: 1 \/ 3 sessions/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: data-testid, data-display-mode, data-scope, data-activity-id unchanged
// ---------------------------------------------------------------------------

describe('UX-A10 AC-5 — bar-mode row attributes are unchanged', () => {
  it('preserves data-testid and data-display-mode="bar" on a class-scoped bar row', () => {
    const row = makeClassRow({ id: 'r5a' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    const el = screen.getByTestId('load-risk-rule-row-r5a');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-display-mode', 'bar');
  });

  it('preserves data-scope="class" on a class-scoped bar row', () => {
    const row = makeClassRow({ id: 'r5b' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    const el = screen.getByTestId('load-risk-rule-row-r5b');
    expect(el).toHaveAttribute('data-scope', 'class');
  });

  it('preserves data-scope="activity" and data-activity-id on an activity-scoped bar row', () => {
    const row = makeActivityRow({ id: 'r5c', activityId: 'act-run' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    const el = screen.getByTestId('load-risk-rule-row-r5c');
    expect(el).toHaveAttribute('data-scope', 'activity');
    expect(el).toHaveAttribute('data-activity-id', 'act-run');
  });
});

// ---------------------------------------------------------------------------
// AC-6: A group with ONLY status rows produces no class-group header
// ---------------------------------------------------------------------------

describe('UX-A10 AC-6 — status-only group suppresses class header', () => {
  it('does not render a class group header when all rows in that group are status-mode', () => {
    // Two status rows, same class, no bar rows
    const row1 = makeStatusRow({ id: 'r6a', activityClassId: 'cls-status-only' });
    const row2 = makeStatusRow({
      id: 'r6b',
      activityClassId: 'cls-status-only',
      label: 'Another status label',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row1, row2])} />);

    // The class-group wrapper must not exist in the DOM
    expect(
      screen.queryByTestId('load-risk-class-group-cls-status-only'),
    ).not.toBeInTheDocument();

    // No orphaned class header text
    expect(screen.queryByText('High-Intensity Foot Load')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7: Mixed group renders bar rows normally; status rows suppressed
// ---------------------------------------------------------------------------

describe('UX-A10 AC-7 — mixed group: bar rows render, status rows are suppressed', () => {
  it('renders the bar-mode row and suppresses the status-mode row in the same class group', () => {
    const barRow = makeClassRow({ id: 'r7-bar', activityClassId: 'cls-mixed' });
    const statusRow = makeStatusRow({ id: 'r7-status', activityClassId: 'cls-mixed' });

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([barRow, statusRow])} />);

    // Bar row renders
    expect(screen.getByTestId('load-risk-rule-row-r7-bar')).toBeInTheDocument();
    expect(screen.getByTestId('load-risk-rule-row-r7-bar')).toHaveAttribute(
      'data-display-mode',
      'bar',
    );

    // Status row does NOT render
    expect(screen.queryByTestId('load-risk-rule-row-r7-status')).not.toBeInTheDocument();

    // Status row label text does NOT appear
    expect(
      screen.queryByText('6 days since last session (3-day minimum)'),
    ).not.toBeInTheDocument();
  });

  it('class group header still appears when the group has at least one bar-mode row', () => {
    const barRow = makeClassRow({ id: 'r7b-bar', activityClassId: 'cls-mixed-2' });
    const statusRow = makeStatusRow({ id: 'r7b-status', activityClassId: 'cls-mixed-2' });

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([barRow, statusRow])} />);

    // Class group header (rendered by groupRuleRowsByClass → group.className) must remain
    expect(screen.getByTestId('load-risk-class-group-cls-mixed-2')).toBeInTheDocument();
  });
});
