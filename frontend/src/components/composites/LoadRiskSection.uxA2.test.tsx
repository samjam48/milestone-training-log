/**
 * UX-A2 — Load risk: daily/weekly period prefix on rule rows.
 * plans/tickets-ux-overhaul-2026-06-12.md §UX-A2
 *
 * Acceptance criteria:
 *   AC-1  daily_volume_cap row shows "Daily:" prefix before value
 *   AC-2  weekly_volume_cap row shows "Weekly:" prefix
 *   AC-3  weekly_load_cap row shows "Weekly:" prefix
 *   AC-4  frequency_limit row shows "Weekly:" prefix
 *   AC-5  rest_between_class row shows NO period prefix
 *   AC-6  consecutive_day_limit row shows NO period prefix
 *   AC-7  Unknown ruleType shows no prefix and does not crash
 *   AC-8  displayMode: 'status' rows render nothing (superseded by UX-A10)
 *
 * Prefix format per ticket: "Daily: {value}" / "Weekly: {value}" (colon + space).
 * Progress bar geometry and data-testid hooks must be unchanged.
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

function makeRow(
  overrides: Partial<LoadRiskSummary['ruleLimitRows'][number]> &
    Pick<
      LoadRiskSummary['ruleLimitRows'][number],
      'id' | 'ruleType' | 'displayMode'
    >,
): LoadRiskSummary['ruleLimitRows'][number] {
  return {
    scope: 'class',
    ruleId: 'rule-1',
    activityClassId: 'cls-1',
    className: 'Test Class',
    actual: 3,
    limit: 10,
    unit: 'km',
    state: 'safe',
    label: 'Test label',
    ...overrides,
  };
}

function buildSummary(
  rows: LoadRiskSummary['ruleLimitRows'],
): LoadRiskSummary {
  return { weekDays: SAFE_WEEK_DAYS, ruleLimitRows: rows };
}

// ---------------------------------------------------------------------------
// AC-1: daily_volume_cap → "Daily:" prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — daily_volume_cap row', () => {
  it('shows "Daily:" prefix before the actual/limit value (AC-1)', () => {
    const row = makeRow({ id: 'r1', ruleType: 'daily_volume_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // The value text should include the prefix
    expect(screen.getByText(/^Daily:/)).toBeInTheDocument();
    // The full rendered text should include the underlying value
    expect(screen.getByText(/3 \/ 10 km/)).toBeInTheDocument();
  });

  it('does not show "Weekly:" prefix for daily_volume_cap (AC-1)', () => {
    const row = makeRow({ id: 'r1', ruleType: 'daily_volume_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/^Weekly:/)).not.toBeInTheDocument();
  });

  it('preserves data-testid on the row wrapper (AC-1 — geometry unchanged)', () => {
    const row = makeRow({ id: 'r1', ruleType: 'daily_volume_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByTestId('load-risk-rule-row-r1')).toBeInTheDocument();
    expect(screen.getByTestId('load-risk-rule-row-r1')).toHaveAttribute(
      'data-display-mode',
      'bar',
    );
  });
});

// ---------------------------------------------------------------------------
// AC-2: weekly_volume_cap → "Weekly:" prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — weekly_volume_cap row', () => {
  it('shows "Weekly:" prefix before the actual/limit value (AC-2)', () => {
    const row = makeRow({ id: 'r2', ruleType: 'weekly_volume_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/^Weekly:/)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 km/)).toBeInTheDocument();
  });

  it('does not show "Daily:" prefix for weekly_volume_cap (AC-2)', () => {
    const row = makeRow({ id: 'r2', ruleType: 'weekly_volume_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/^Daily:/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: weekly_load_cap → "Weekly:" prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — weekly_load_cap row', () => {
  it('shows "Weekly:" prefix before the actual/limit value (AC-3)', () => {
    const row = makeRow({ id: 'r3', ruleType: 'weekly_load_cap', displayMode: 'bar' });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/^Weekly:/)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 km/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-4: frequency_limit → "Weekly:" prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — frequency_limit row', () => {
  it('shows "Weekly:" prefix before the actual/limit value (AC-4)', () => {
    const row = makeRow({
      id: 'r4',
      ruleType: 'frequency_limit',
      displayMode: 'bar',
      unit: 'sessions',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByText(/^Weekly:/)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 sessions/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: rest_between_class → NO prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — rest_between_class row', () => {
  it('shows no period prefix (AC-5)', () => {
    const row = makeRow({
      id: 'r5',
      ruleType: 'rest_between_class',
      displayMode: 'bar',
      unit: 'days',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/^Daily:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Weekly:/)).not.toBeInTheDocument();
    // Value still renders
    expect(screen.getByText(/3 \/ 10 days/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-6: consecutive_day_limit → NO prefix
// ---------------------------------------------------------------------------

describe('UX-A2 — consecutive_day_limit row', () => {
  it('shows no period prefix (AC-6)', () => {
    const row = makeRow({
      id: 'r6',
      ruleType: 'consecutive_day_limit',
      displayMode: 'bar',
      unit: 'days',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByText(/^Daily:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Weekly:/)).not.toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10 days/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-7: Unknown / future ruleType → no prefix, no crash
// ---------------------------------------------------------------------------

describe('UX-A2 — unknown ruleType', () => {
  it('renders with no prefix and does not throw (AC-7)', () => {
    const row = makeRow({
      id: 'r7',
      ruleType: 'future_unknown_rule_type',
      displayMode: 'bar',
    });
    expect(() =>
      renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />),
    ).not.toThrow();

    expect(screen.queryByText(/^Daily:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Weekly:/)).not.toBeInTheDocument();
    // Underlying value still renders
    expect(screen.getByText(/3 \/ 10 km/)).toBeInTheDocument();
  });

  it('preserves the data-testid on the row wrapper for unknown ruleType (AC-7)', () => {
    const row = makeRow({
      id: 'r7',
      ruleType: 'future_unknown_rule_type',
      displayMode: 'bar',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.getByTestId('load-risk-rule-row-r7')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-8: displayMode: 'status' rows — updated by UX-A10
//
// UX-A2 originally asserted that status rows render label text (AC-8).
// UX-A10 removes status-mode rows entirely (return null). These tests are
// updated to assert the new behaviour: status rows produce no DOM output and
// no period prefix. The underlying AC-8 guarantee (no prefix injected into
// status rows) is preserved by the fact that they render nothing at all.
// ---------------------------------------------------------------------------

describe('UX-A2 — displayMode status rows (updated by UX-A10)', () => {
  it('does not render status-mode rows — no DOM node produced (AC-8 / UX-A10)', () => {
    const row = makeRow({
      id: 'r8',
      ruleType: 'rest_between_class',
      displayMode: 'status',
      label: 'Rest OK',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // UX-A10: status rows render null — testid must be absent
    expect(screen.queryByTestId('load-risk-rule-row-r8')).not.toBeInTheDocument();
    // Label text must also be absent
    expect(screen.queryByText('Rest OK')).not.toBeInTheDocument();
  });

  it('does not inject period prefix into status-mode rows — they render nothing (AC-8 / UX-A10)', () => {
    const row = makeRow({
      id: 'r9',
      ruleType: 'weekly_volume_cap',
      displayMode: 'status',
      label: 'Volume cap status',
    });
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    // Status rows produce no DOM: no prefix, no label text
    expect(screen.queryByText(/^Weekly:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Volume cap status')).not.toBeInTheDocument();
  });
});
