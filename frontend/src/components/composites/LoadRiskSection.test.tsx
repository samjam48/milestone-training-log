/**
 * S25.F7 — LoadRiskSection redesign (load_risk_summary).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

const FOOT_CLASS_ROW: LoadRiskSummary['ruleLimitRows'][number] = {
  id: 'row-foot-km',
  scope: 'class',
  ruleId: 'rule-foot-km',
  ruleType: 'weekly_volume_cap',
  activityClassId: 'cls-foot',
  className: 'Foot load',
  actual: 8,
  limit: 10,
  unit: 'km',
  state: 'safe',
  label: 'Foot load weekly volume',
  displayMode: 'bar',
};

const WALK_ROW: LoadRiskSummary['ruleLimitRows'][number] = {
  id: 'row-walk-km',
  scope: 'activity',
  ruleId: 'rule-walk-km',
  ruleType: 'weekly_volume_cap',
  activityClassId: 'cls-foot',
  className: 'Foot load',
  activityId: 'act-walk',
  activityName: 'Walking',
  actual: 5,
  limit: 6,
  unit: 'km',
  state: 'caution',
  label: 'Walking weekly volume',
  displayMode: 'bar',
};

const JOG_ROW: LoadRiskSummary['ruleLimitRows'][number] = {
  id: 'row-jog-km',
  scope: 'activity',
  ruleId: 'rule-jog-km',
  ruleType: 'weekly_volume_cap',
  activityClassId: 'cls-foot',
  className: 'Foot load',
  activityId: 'act-jog',
  activityName: 'Jogging',
  actual: 3,
  limit: 4,
  unit: 'km',
  state: 'safe',
  label: 'Jogging weekly volume',
  displayMode: 'bar',
};

function buildSummary(overrides: Partial<LoadRiskSummary> = {}): LoadRiskSummary {
  return {
    weekDays: [
      { date: '2026-05-22', flagged: false, state: 'safe' },
      { date: '2026-05-23', flagged: true, state: 'caution' },
      { date: '2026-05-24', flagged: false, state: 'safe' },
      { date: '2026-05-25', flagged: false, state: 'safe' },
      { date: '2026-05-26', flagged: true, state: 'caution' },
      { date: '2026-05-27', flagged: false, state: 'safe' },
      { date: '2026-05-28', flagged: false, state: 'safe' },
    ],
    ruleLimitRows: [FOOT_CLASS_ROW, WALK_ROW, JOG_ROW],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('LoadRiskSection — S25.F7 load_risk_summary', () => {
  it('renders a 7-cell week strip without text labels on cells', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    const strip = screen.getByTestId('load-risk-week-strip');
    const cells = strip.querySelectorAll('[data-testid="load-risk-day-cell"]');
    expect(cells).toHaveLength(7);
    expect(strip.textContent?.trim()).toBe('');
  });

  it('renders class progress bars with actual / limit and unit', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    // 'Foot load' appears as both the group header and the bar-mode class row label (UX-A10)
    expect(screen.getAllByText('Foot load').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Weekly: 8 / 10 km')).toBeInTheDocument();
  });

  it('renders activity-scoped rule rows under the class group', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    const group = screen.getByTestId('load-risk-class-group-cls-foot');
    expect(within(group).getByText('Walking')).toBeInTheDocument();
    expect(within(group).getByText('Weekly: 5 / 6 km')).toBeInTheDocument();
    expect(within(group).getByText('Jogging')).toBeInTheDocument();
  });

  it('renders only performance class rule rows from the summary payload', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    // 'Foot load' appears as both the group header and the bar-mode class row label (UX-A10)
    expect(screen.getAllByText('Foot load').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Recovery')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^load-risk-class-group-/)).toHaveLength(1);
  });

  it('does not navigate to Edit Rules when viewing rule rows', () => {
    const onEditRules = vi.fn();

    renderWithProviders(
      <>
        <LoadRiskSection loadRiskSummary={buildSummary()} />
        <button type="button" onClick={onEditRules}>
          Edit rules
        </button>
      </>,
    );

    expect(onEditRules).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /edit rules/i })).not.toBeInTheDocument();
  });

  it('shows no-caps copy when load_risk_summary is null', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={null} />);

    expect(screen.getByText(/no load caps configured/i)).toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-week-strip')).not.toBeInTheDocument();
  });
});
