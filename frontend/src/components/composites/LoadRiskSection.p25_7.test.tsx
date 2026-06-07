/**
 * P25.7 — Load-risk exercise bars display volume-cap units
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

function buildSummary(
  exerciseUnit: string,
  actual: number,
  limit: number,
): LoadRiskSummary {
  return {
    weekDays: [
      { date: '2026-05-22', flagged: false },
      { date: '2026-05-23', flagged: false },
      { date: '2026-05-24', flagged: false },
      { date: '2026-05-25', flagged: false },
      { date: '2026-05-26', flagged: false },
      { date: '2026-05-27', flagged: false },
      { date: '2026-05-28', flagged: false },
    ],
    classBars: [
      {
        activityClassId: 'cls-foot',
        className: 'Foot load',
        actual,
        limit,
        unit: exerciseUnit,
        exercises: [
          {
            activityId: 'act-walk',
            activityName: 'Walking',
            actual,
            limit,
            unit: exerciseUnit,
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  cleanup();
});

describe('LoadRiskSection — P25.7 volume-cap units', () => {
  it('renders exercise bar actual/limit with hours unit', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LoadRiskSection loadRiskSummary={buildSummary('hours', 1.5, 3)} />,
    );

    await user.click(screen.getByTestId('load-risk-class-row-cls-foot'));

    const panel = screen.getByTestId('load-risk-exercise-bars');
    expect(within(panel).getByText('1.5 / 3 hours')).toBeInTheDocument();
  });

  it('renders exercise bar actual/limit with minutes unit', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LoadRiskSection loadRiskSummary={buildSummary('minutes', 45, 60)} />,
    );

    await user.click(screen.getByTestId('load-risk-class-row-cls-foot'));

    const panel = screen.getByTestId('load-risk-exercise-bars');
    expect(within(panel).getByText('45 / 60 minutes')).toBeInTheDocument();
  });

  it('renders class bar actual/limit with km unit from volume-cap summary', () => {
    renderWithProviders(
      <LoadRiskSection loadRiskSummary={buildSummary('km', 8, 12)} />,
    );

    expect(screen.getByText('8 / 12 km')).toBeInTheDocument();
  });
});
