// =============================================================================
// GoalsCard — dashboard goal summary rows (S25.F2)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { GoalDashboardRow } from '../../types';

export interface GoalsCardProps {
  goalRows: GoalDashboardRow[];
}

function formatStatusLabel(status: GoalDashboardRow['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function numericValueText(row: GoalDashboardRow): string | undefined {
  if (
    row.progressValue != null &&
    row.progressTarget != null &&
    row.progressUnit != null
  ) {
    return `${row.progressValue} / ${row.progressTarget} ${row.progressUnit}`;
  }
  return undefined;
}

export const GoalsCard: React.FC<GoalsCardProps> = ({ goalRows }) => {
  if (goalRows.length === 0) {
    return null;
  }

  return (
    <div data-testid="goals-card">
      <p className="text-label uppercase font-medium text-ink-muted mb-2">Goals</p>
      <Card pad="md">
        <ul className="flex max-h-64 flex-col gap-4 overflow-y-auto">
          {goalRows.map((row) => {
            const achieved = row.status === 'achieved';
            const fillRatio = row.fillRatio ?? 0;

            return (
              <li
                key={row.goalId}
                data-testid={`goals-card-row-${row.goalId}`}
                data-achieved={achieved ? 'true' : 'false'}
                className={cn(achieved && 'opacity-60 text-ink-muted')}
              >
                {row.isQualitative ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body font-medium text-ink">{row.title}</span>
                    <span
                      data-testid="goals-card-status-pill"
                      className="rounded-pill bg-bg-sunken px-2.5 py-0.5 text-caption font-medium capitalize text-ink-muted"
                    >
                      {formatStatusLabel(row.status)}
                    </span>
                  </div>
                ) : (
                  <ProgressBar
                    label={row.title}
                    value={fillRatio}
                    target={1}
                    state={achieved ? 'neutral' : 'safe'}
                    valueText={numericValueText(row)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};
