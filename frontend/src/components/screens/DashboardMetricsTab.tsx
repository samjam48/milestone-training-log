import * as React from 'react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { GoalsCard } from '../composites/GoalsCard';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { SafetyState } from '../../types';

interface DashboardMetricsTabProps {
  engine: MilestoneEngineResult;
  onViewGoals?: () => void;
}

function formatShort(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function progressLabel(value: number, unit: string): string {
  if (unit === 'sessions') return `${value} session${value === 1 ? '' : 's'}`;
  return `${value} ${unit}`;
}

function weeklyProgressRowLabel(
  activityName: string | null | undefined,
  className: string,
): string {
  return activityName ?? className;
}

function weeklyProgressDisplayState(
  value: number,
  target: number,
  state: SafetyState | 'neutral',
): SafetyState | 'neutral' {
  if (target > 0 && value >= target) {
    return 'safe';
  }
  return state;
}

function formatWeekPeriod(start: string, end: string): string {
  return `${formatShort(start)} - ${formatShort(end)}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-label uppercase font-medium text-ink-muted mb-2">{children}</p>;
}

export const DashboardMetricsTab: React.FC<DashboardMetricsTabProps> = ({
  engine,
  onViewGoals,
}) => {
  const { weeklyProgress, goalRows } = engine;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel>This week</SectionLabel>
        {weeklyProgress[0]?.periodStart != null && weeklyProgress[0]?.periodEnd != null ? (
          <p className="text-caption text-ink-muted -mt-1 mb-2">
            {formatWeekPeriod(weeklyProgress[0].periodStart, weeklyProgress[0].periodEnd)}
          </p>
        ) : null}
        {weeklyProgress.length === 0 ? (
          <Card intent="info" pad="md" data-testid="weekly-targets-empty-state">
            <p className="text-body text-info-fg font-medium">No weekly goals set</p>
            <p className="text-caption text-ink-muted mt-0.5">
              Track your weekly progress by adding goals.
            </p>
            {onViewGoals != null && (
              <button
                type="button"
                onClick={onViewGoals}
                className="mt-3 text-caption font-semibold text-info-fg underline hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-fg rounded"
              >
                Set up goals
              </button>
            )}
          </Card>
        ) : (
          <Card pad="md">
            <div className="flex flex-col gap-4">
              {weeklyProgress.map((wp) => (
                <ProgressBar
                  key={wp.weeklyTargetId}
                  value={wp.value}
                  target={wp.target}
                  state={weeklyProgressDisplayState(wp.value, wp.target, wp.state)}
                  label={weeklyProgressRowLabel(wp.activityName, wp.className)}
                  valueText={`${progressLabel(wp.value, wp.unit)} / ${progressLabel(wp.target, wp.unit)}`}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      <GoalsCard goalRows={goalRows} />
    </div>
  );
};
