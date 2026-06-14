/**
 * WTL.F5 — Load risk UI for rule-limit rows (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F5
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  WTL_F5_CLASS_NAME,
  WTL_F5_EMPTY_COPY,
  wtlF5BikeDailyVolumeRow,
  wtlF5ClassFrequencyRow,
  wtlF5ClassRestRow,
  wtlF5EmptySummary,
  wtlF5FootLoadSummary,
  wtlF5WalkWeeklyVolumeRow,
  wtlF5WeekDays,
  type LoadRiskSummaryWtlF5,
} from '../../test/wtlF5LoadRiskFixtures';
import type { LoadRiskSummary } from '../../lib/engine';
import { LoadRiskSection } from './LoadRiskSection';

afterEach(() => {
  cleanup();
});

function renderLoadRisk(summary: LoadRiskSummaryWtlF5 | null) {
  return renderWithProviders(
    <LoadRiskSection loadRiskSummary={summary as LoadRiskSummary | null} />,
  );
}

function weekStrip(): HTMLElement {
  return screen.getByTestId('load-risk-week-strip');
}

function dayCells(): HTMLElement[] {
  return Array.from(weekStrip().querySelectorAll('[data-testid="load-risk-day-cell"]'));
}

describe('LoadRiskSection — WTL.F5 rule-limit rows grouped by class', () => {
  it('renders one class group per activity class with multiple rule rows', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const groups = screen.getAllByTestId(/^load-risk-class-group-/);
    expect(groups).toHaveLength(1);
    // WTL_F5_CLASS_NAME now appears in both the group header and class-scoped bar labels (UX-A10)
    expect(within(groups[0]!).getAllByText(WTL_F5_CLASS_NAME).length).toBeGreaterThanOrEqual(1);

    // UX-A10: status rows are suppressed; only bar-mode rows render
    const barRowCount = wtlF5FootLoadSummary.ruleLimitRows.filter(
      (r) => r.displayMode !== 'status',
    ).length;
    const ruleRows = within(groups[0]!).getAllByTestId(/^load-risk-rule-row-/);
    expect(ruleRows).toHaveLength(barRowCount);
  });

  it('does not collapse exercise caps into a single class-wide bar', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    expect(screen.queryByTestId('load-risk-class-bars')).not.toBeInTheDocument();
    expect(screen.getByTestId('load-risk-rule-rows')).toBeInTheDocument();
    expect(screen.getByText('Weekly: 4 / 3 sessions')).toBeInTheDocument();
    expect(screen.getByText('Weekly: 7 / 8 km')).toBeInTheDocument();
    expect(screen.getByText('Daily: 20 / 45 minutes')).toBeInTheDocument();
    expect(screen.queryByText(/0 \/ 8 km/i)).not.toBeInTheDocument();
  });
});

describe('LoadRiskSection — WTL.F5 class vs activity row distinction', () => {
  it('marks class-scoped rows with data-scope="class"', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const classRow = screen.getByTestId(`load-risk-rule-row-${wtlF5ClassFrequencyRow.id}`);
    expect(classRow).toHaveAttribute('data-scope', 'class');
    expect(classRow).not.toHaveAttribute('data-activity-id');
  });

  it('marks activity-scoped rows with data-scope="activity" and activity metadata', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const walkRow = screen.getByTestId(`load-risk-rule-row-${wtlF5WalkWeeklyVolumeRow.id}`);
    expect(walkRow).toHaveAttribute('data-scope', 'activity');
    expect(walkRow).toHaveAttribute('data-activity-id', wtlF5WalkWeeklyVolumeRow.activityId);
    expect(within(walkRow).getByText('Morning Walk')).toBeInTheDocument();

    const bikeRow = screen.getByTestId(`load-risk-rule-row-${wtlF5BikeDailyVolumeRow.id}`);
    expect(bikeRow).toHaveAttribute('data-scope', 'activity');
    expect(within(bikeRow).getByText('Stationary Bike')).toBeInTheDocument();
  });
});

describe('LoadRiskSection — WTL.F5 fill bars vs rest status copy', () => {
  it('renders progress bars for count and volume rule rows', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const freqRow = screen.getByTestId(`load-risk-rule-row-${wtlF5ClassFrequencyRow.id}`);
    expect(freqRow).toHaveAttribute('data-display-mode', 'bar');
    expect(within(freqRow).getByRole('progressbar')).toBeInTheDocument();
    expect(within(freqRow).getByText('Weekly: 4 / 3 sessions')).toBeInTheDocument();

    const walkRow = screen.getByTestId(`load-risk-rule-row-${wtlF5WalkWeeklyVolumeRow.id}`);
    expect(walkRow).toHaveAttribute('data-display-mode', 'bar');
    expect(within(walkRow).getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not render status-mode rows — rest-spacing rows produce no DOM output (UX-A10)', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    // UX-A10: status rows render null; the row wrapper must be absent
    expect(
      screen.queryByTestId(`load-risk-rule-row-${wtlF5ClassRestRow.id}`),
    ).not.toBeInTheDocument();
    // Label text must also be absent
    expect(screen.queryByText(wtlF5ClassRestRow.label)).not.toBeInTheDocument();
  });

  it('applies danger styling on over-limit fill rows', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const freqRow = screen.getByTestId(`load-risk-rule-row-${wtlF5ClassFrequencyRow.id}`);
    const fill = within(freqRow).getByRole('progressbar').firstElementChild;
    expect(fill?.className).toMatch(/bg-danger/);
  });
});

describe('LoadRiskSection — WTL.F5 week strip load-tax state', () => {
  it('renders seven day cells with data-state from the API payload', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const cells = dayCells();
    expect(cells).toHaveLength(7);
    cells.forEach((cell, index) => {
      expect(cell).toHaveAttribute('data-state', wtlF5WeekDays[index]!.state);
    });
  });

  it('colors strip cells from load-tax state instead of flagged boolean alone', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    const dangerCell = dayCells().find(
      (cell) => cell.getAttribute('data-state') === 'danger',
    );
    expect(dangerCell?.className).toMatch(/danger/);

    const safeCell = dayCells().find((cell) => cell.getAttribute('data-state') === 'safe');
    expect(safeCell?.className).not.toMatch(/danger/);
  });
});

describe('LoadRiskSection — WTL.F5 empty and section chrome', () => {
  it('keeps the Load risk section title', () => {
    renderLoadRisk(wtlF5FootLoadSummary);

    expect(screen.getByText('Load risk')).toBeInTheDocument();
  });

  it('shows empty copy when rule_limit_rows is empty', () => {
    renderLoadRisk(wtlF5EmptySummary);

    expect(screen.getByText(WTL_F5_EMPTY_COPY)).toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-rule-rows')).not.toBeInTheDocument();
    expect(screen.getByTestId('load-risk-week-strip')).toBeInTheDocument();
  });
});
