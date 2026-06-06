// =============================================================================
// LoadRiskSection — cap-driven load risk from dashboard load_risk_summary (S25.F7)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { LoadRiskClassBar, LoadRiskSummary } from '../../lib/engine';
import type { SafetyState } from '../../types';

const NO_CAPS_COPY = 'No load caps configured.';

function barState(actual: number, limit: number): SafetyState | 'neutral' {
  if (limit <= 0) return 'neutral';
  const ratio = actual / limit;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.8) return 'caution';
  return 'safe';
}

function formatActualLimit(actual: number, limit: number, unit: string): string {
  const roundedActual = Number.isInteger(actual) ? actual : Math.round(actual * 10) / 10;
  const roundedLimit = Number.isInteger(limit) ? limit : Math.round(limit * 10) / 10;
  return `${roundedActual} / ${roundedLimit} ${unit}`;
}

function nearTargetExerciseNames(bar: LoadRiskClassBar): string {
  const names = bar.exercises
    .filter((exercise) => exercise.limit > 0 && exercise.actual / exercise.limit >= 0.8)
    .map((exercise) => exercise.activityName);
  return names.join(', ');
}

const LoadRiskWeekStrip: React.FC<{
  weekDays: LoadRiskSummary['weekDays'];
}> = ({ weekDays }) => (
  <div
    className="mb-4"
    data-testid="load-risk-week-strip"
    aria-label="Last seven days load risk flags"
  >
    <div className="grid grid-cols-7 gap-1.5">
      {weekDays.map((day) => (
        <div
          key={day.date}
          data-testid="load-risk-day-cell"
          className={cn(
            'h-8 w-full rounded-md transition-colors duration-snap',
            day.flagged ? 'bg-caution/35 ring-1 ring-caution/60' : 'bg-bg-sunken',
          )}
          data-flagged={day.flagged ? 'true' : 'false'}
          title={day.date}
        />
      ))}
    </div>
  </div>
);

export interface LoadRiskSectionProps {
  loadRiskSummary: LoadRiskSummary | null;
}

export const LoadRiskSection: React.FC<LoadRiskSectionProps> = ({ loadRiskSummary }) => {
  const [expandedClassId, setExpandedClassId] = React.useState<string | null>(null);

  if (loadRiskSummary == null) {
    return (
      <div data-testid="load-risk-section">
        <p className="text-label uppercase font-medium text-ink-muted mb-2">Load risk</p>
        <Card pad="md">
          <p className="text-caption text-ink-muted">{NO_CAPS_COPY}</p>
        </Card>
      </div>
    );
  }

  const { weekDays, classBars } = loadRiskSummary;
  const hasClassBars = classBars.length > 0;
  const hasFlaggedDay = weekDays.some((day) => day.flagged);

  return (
    <div data-testid="load-risk-section">
      <p className="text-label uppercase font-medium text-ink-muted mb-2">Load risk</p>
      <Card intent={hasFlaggedDay || hasClassBars ? 'caution' : 'default'} pad="md">
        <LoadRiskWeekStrip weekDays={weekDays} />

        {hasClassBars ? (
          <div className="flex flex-col gap-3" data-testid="load-risk-class-bars">
            {classBars.map((bar) => {
              const exerciseHint = nearTargetExerciseNames(bar);
              const isExpanded = expandedClassId === bar.activityClassId;

              return (
                <div key={bar.activityClassId}>
                  <button
                    type="button"
                    data-testid={`load-risk-class-row-${bar.activityClassId}`}
                    className="w-full text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpandedClassId((current) =>
                        current === bar.activityClassId ? null : bar.activityClassId,
                      )
                    }
                  >
                    <ProgressBar
                      value={bar.actual}
                      target={bar.limit}
                      state={barState(bar.actual, bar.limit)}
                      overshootAt={0.99}
                      dangerAt={1}
                      label={
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate">{bar.className}</span>
                          {exerciseHint && (
                            <span className="text-caption font-normal text-ink-muted truncate">
                              {exerciseHint}
                            </span>
                          )}
                        </span>
                      }
                      valueText={formatActualLimit(bar.actual, bar.limit, bar.unit)}
                    />
                  </button>

                  {isExpanded && bar.exercises.length > 0 && (
                    <div
                      className="mt-2 ml-2 flex max-h-48 flex-col gap-3 overflow-y-auto border-l border-border-subtle pl-3"
                      data-testid="load-risk-exercise-bars"
                    >
                      {bar.exercises.map((exercise) => (
                        <ProgressBar
                          key={exercise.activityId}
                          size="sm"
                          value={exercise.actual}
                          target={exercise.limit}
                          state={barState(exercise.actual, exercise.limit)}
                          overshootAt={0.99}
                          dangerAt={1}
                          label={
                            <span className="text-caption text-ink truncate">
                              {exercise.activityName}
                            </span>
                          }
                          valueText={formatActualLimit(
                            exercise.actual,
                            exercise.limit,
                            exercise.unit,
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-caption text-ink-muted -mt-2">{NO_CAPS_COPY}</p>
        )}
      </Card>
    </div>
  );
};
