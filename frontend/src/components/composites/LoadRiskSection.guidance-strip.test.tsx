import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

afterEach(() => {
  cleanup();
});

const CAUTION_GUIDANCE =
  'Ease back a little: keep the next session light and watch how symptoms respond.';
const DANGER_GUIDANCE =
  'Reduce load today: choose recovery or a lighter session before adding more.';

const SAFE_WEEK_DAYS: LoadRiskSummary['weekDays'] = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-06-${String(index + 1).padStart(2, '0')}`,
  flagged: false,
  state: 'safe' as const,
}));

type Row = LoadRiskSummary['ruleLimitRows'][number];

function makeRow(overrides: Partial<Row> & Pick<Row, 'id'>): Row {
  const { id, ...rest } = overrides;

  return {
    id,
    scope: 'class',
    ruleId: 'rule-foot-weekly',
    ruleType: 'weekly_volume_cap',
    activityClassId: 'cls-foot',
    className: 'Foot load',
    actual: 5,
    limit: 10,
    unit: 'km',
    state: 'safe',
    label: 'Foot load weekly volume',
    displayMode: 'bar',
    ...rest,
  };
}

function buildSummary(
  rows: LoadRiskSummary['ruleLimitRows'],
  weekDays: LoadRiskSummary['weekDays'] = SAFE_WEEK_DAYS,
): LoadRiskSummary {
  return { weekDays, ruleLimitRows: rows };
}

function expectWeekStripAndProgressRow(rowId: string): void {
  const strip = screen.getByTestId('load-risk-week-strip');
  expect(strip.querySelectorAll('[data-testid="load-risk-day-cell"]')).toHaveLength(7);
  expect(screen.getByTestId(`load-risk-rule-row-${rowId}`)).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
}

describe('LoadRiskSection guidance strip', () => {
  it('shows a yellow advisory strip when the overall state is caution', () => {
    const row = makeRow({ id: 'caution-row', actual: 9, limit: 10, state: 'caution' });

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    const guidance = screen.getByTestId('load-risk-guidance-strip');
    expect(guidance).toHaveAttribute('data-state', 'caution');
    expect(guidance).toHaveTextContent(CAUTION_GUIDANCE);
    expect(guidance.className).toMatch(/bg-caution/);
    expect(guidance.className).toMatch(/border-caution/);
    expect(guidance).not.toHaveTextContent(/alarm|emergency|stop/i);
    expectWeekStripAndProgressRow('caution-row');
  });

  it('shows a red advisory strip when a week-day risk makes the overall state danger', () => {
    const row = makeRow({ id: 'safe-row' });
    const dangerWeekDays = SAFE_WEEK_DAYS.map((day, index) =>
      index === 3 ? { ...day, flagged: true, state: 'danger' as const } : day,
    );

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row], dangerWeekDays)} />);

    const guidance = screen.getByTestId('load-risk-guidance-strip');
    expect(guidance).toHaveAttribute('data-state', 'danger');
    expect(guidance).toHaveTextContent(DANGER_GUIDANCE);
    expect(guidance.className).toMatch(/bg-danger/);
    expect(guidance.className).toMatch(/border-danger/);
    expect(guidance).not.toHaveTextContent(/alarm|emergency|stop/i);
    expectWeekStripAndProgressRow('safe-row');
  });

  it('uses the worst row state when rule rows are mixed', () => {
    const safeRow = makeRow({ id: 'safe-mixed-row' });
    const cautionRow = makeRow({
      id: 'caution-mixed-row',
      actual: 9,
      limit: 10,
      state: 'caution',
    });
    const dangerRow = makeRow({
      id: 'danger-mixed-row',
      actual: 11,
      limit: 10,
      state: 'danger',
    });

    renderWithProviders(
      <LoadRiskSection loadRiskSummary={buildSummary([safeRow, cautionRow, dangerRow])} />,
    );

    const guidance = screen.getByTestId('load-risk-guidance-strip');
    expect(guidance).toHaveAttribute('data-state', 'danger');
    expect(guidance).toHaveTextContent(DANGER_GUIDANCE);
    expect(guidance).not.toHaveTextContent(CAUTION_GUIDANCE);
    expect(screen.getAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getByTestId('load-risk-week-strip')).toBeInTheDocument();
  });

  it('shows no guidance strip when all configured rules and week days are safe', () => {
    const row = makeRow({ id: 'safe-only-row' });

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([row])} />);

    expect(screen.queryByTestId('load-risk-guidance-strip')).not.toBeInTheDocument();
    expectWeekStripAndProgressRow('safe-only-row');
  });

  it('shows no guidance strip when no rules are configured, even if week days are flagged', () => {
    const dangerWeekDays = SAFE_WEEK_DAYS.map((day, index) =>
      index === 2 ? { ...day, flagged: true, state: 'danger' as const } : day,
    );

    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary([], dangerWeekDays)} />);

    expect(screen.queryByTestId('load-risk-guidance-strip')).not.toBeInTheDocument();
    expect(screen.getByTestId('load-risk-week-strip')).toBeInTheDocument();
    expect(screen.getByText('No load rules are configured.')).toBeInTheDocument();
  });
});
