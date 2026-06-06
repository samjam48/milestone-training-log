/**
 * S25.F7 — LoadRiskSection redesign (load_risk_summary).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

const CAPPED_CLASS: LoadRiskSummary['classBars'][number] = {
  activityClassId: 'cls-foot',
  className: 'Foot load',
  actual: 8,
  limit: 10,
  unit: 'km',
  exercises: [
    {
      activityId: 'act-walk',
      activityName: 'Walking',
      actual: 5,
      limit: 6,
      unit: 'km',
    },
    {
      activityId: 'act-jog',
      activityName: 'Jogging',
      actual: 3,
      limit: 4,
      unit: 'km',
    },
  ],
};

function buildSummary(overrides: Partial<LoadRiskSummary> = {}): LoadRiskSummary {
  return {
    weekDays: [
      { date: '2026-05-22', flagged: false },
      { date: '2026-05-23', flagged: true },
      { date: '2026-05-24', flagged: false },
      { date: '2026-05-25', flagged: false },
      { date: '2026-05-26', flagged: true },
      { date: '2026-05-27', flagged: false },
      { date: '2026-05-28', flagged: false },
    ],
    classBars: [CAPPED_CLASS],
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

    expect(screen.getByText('Foot load')).toBeInTheDocument();
    expect(screen.getByText('8 / 10 km')).toBeInTheDocument();
  });

  it('expands nested exercise bars when a class row is tapped', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    expect(screen.queryByTestId('load-risk-exercise-bars')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('load-risk-class-row-cls-foot'));

    const panel = screen.getByTestId('load-risk-exercise-bars');
    expect(within(panel).getByText('Walking')).toBeInTheDocument();
    expect(within(panel).getByText('5 / 6 km')).toBeInTheDocument();
    expect(within(panel).getByText('Jogging')).toBeInTheDocument();
  });

  it('renders only capped performance class bars from the summary payload', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={buildSummary()} />);

    expect(screen.getByText('Foot load')).toBeInTheDocument();
    expect(screen.queryByText('Recovery')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^load-risk-class-row-/)).toHaveLength(1);
  });

  it('does not navigate to Edit Rules when a class row is tapped', async () => {
    const user = userEvent.setup();
    const onEditRules = vi.fn();

    renderWithProviders(
      <>
        <LoadRiskSection loadRiskSummary={buildSummary()} />
        <button type="button" onClick={onEditRules}>
          Edit rules
        </button>
      </>,
    );

    await user.click(screen.getByTestId('load-risk-class-row-cls-foot'));
    expect(onEditRules).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /edit rules/i })).not.toBeInTheDocument();
  });

  it('shows no-caps copy when load_risk_summary is null', () => {
    renderWithProviders(<LoadRiskSection loadRiskSummary={null} />);

    expect(screen.getByText(/no load caps configured/i)).toBeInTheDocument();
    expect(screen.queryByTestId('load-risk-week-strip')).not.toBeInTheDocument();
  });
});
