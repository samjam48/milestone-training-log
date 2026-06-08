/**
 * P25.7 — Load-risk exercise bars display volume-cap units
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoadRiskSection } from './LoadRiskSection';
import type { LoadRiskSummary } from '../../lib/engine';

const EMPTY_WEEK: LoadRiskSummary['weekDays'] = [
  { date: '2026-05-22', flagged: false, state: 'safe' },
  { date: '2026-05-23', flagged: false, state: 'safe' },
  { date: '2026-05-24', flagged: false, state: 'safe' },
  { date: '2026-05-25', flagged: false, state: 'safe' },
  { date: '2026-05-26', flagged: false, state: 'safe' },
  { date: '2026-05-27', flagged: false, state: 'safe' },
  { date: '2026-05-28', flagged: false, state: 'safe' },
];

function buildSummary(
  rows: LoadRiskSummary['ruleLimitRows'],
): LoadRiskSummary {
  return {
    weekDays: EMPTY_WEEK,
    ruleLimitRows: rows,
  };
}

afterEach(() => {
  cleanup();
});

describe('LoadRiskSection — P25.7 volume-cap units', () => {
  it('renders exercise bar actual/limit with hours unit', () => {
    renderWithProviders(
      <LoadRiskSection
        loadRiskSummary={buildSummary([
          {
            id: 'row-walk-cap',
            scope: 'activity',
            ruleId: 'rule-walk-cap',
            ruleType: 'weekly_volume_cap',
            activityClassId: 'cls-foot',
            className: 'Foot load',
            activityId: 'act-walk',
            activityName: 'Walking',
            actual: 1.5,
            limit: 3,
            unit: 'hours',
            state: 'safe',
            label: 'Walking weekly volume',
            displayMode: 'bar',
          },
        ])}
      />,
    );

    const row = screen.getByTestId('load-risk-rule-row-row-walk-cap');
    expect(within(row).getByText('1.5 / 3 hours')).toBeInTheDocument();
  });

  it('renders exercise bar actual/limit with minutes unit', () => {
    renderWithProviders(
      <LoadRiskSection
        loadRiskSummary={buildSummary([
          {
            id: 'row-walk-cap',
            scope: 'activity',
            ruleId: 'rule-walk-cap',
            ruleType: 'weekly_volume_cap',
            activityClassId: 'cls-foot',
            className: 'Foot load',
            activityId: 'act-walk',
            activityName: 'Walking',
            actual: 45,
            limit: 60,
            unit: 'minutes',
            state: 'safe',
            label: 'Walking weekly volume',
            displayMode: 'bar',
          },
        ])}
      />,
    );

    const row = screen.getByTestId('load-risk-rule-row-row-walk-cap');
    expect(within(row).getByText('45 / 60 minutes')).toBeInTheDocument();
  });

  it('renders class bar actual/limit with km unit from volume-cap summary', () => {
    renderWithProviders(
      <LoadRiskSection
        loadRiskSummary={buildSummary([
          {
            id: 'row-foot-cap',
            scope: 'class',
            ruleId: 'rule-foot-cap',
            ruleType: 'weekly_volume_cap',
            activityClassId: 'cls-foot',
            className: 'Foot load',
            actual: 8,
            limit: 12,
            unit: 'km',
            state: 'safe',
            label: 'Foot load weekly volume',
            displayMode: 'bar',
          },
        ])}
      />,
    );

    const row = screen.getByTestId('load-risk-rule-row-row-foot-cap');
    expect(within(row).getByText('8 / 12 km')).toBeInTheDocument();
  });
});
