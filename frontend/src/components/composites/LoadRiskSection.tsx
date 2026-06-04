// =============================================================================
// LoadRiskSection — visual load-risk flags (proactive delayed-tax hits only)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import {
  buildLoadRiskBarModels,
  contributingDateIso,
  formatDisplayDate,
  proactiveLoadRiskHits,
  riskWindowDayIsos,
} from '../../lib/delayedTaxDisplay';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';

const SAFE_COPY = 'No elevated load or rest-debt flags in the last 7 days.';

export interface LoadRiskSectionProps {
  delayedTax: DelayedTaxResponse | undefined;
  activityClasses: ActivityClass[];
}

function shortWeekday(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    timeZone: 'UTC',
  });
}

const LoadRiskWeekStrip: React.FC<{
  asOf: string;
  windowDays: number;
  flaggedDates: Set<string>;
}> = ({ asOf, windowDays, flaggedDates }) => {
  const days = riskWindowDayIsos(asOf, windowDays);

  return (
    <div
      className="mb-4"
      data-testid="load-risk-week-strip"
      aria-label="Last seven days load risk flags"
    >
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((dayIso) => {
          const flagged = flaggedDates.has(dayIso);
          return (
            <div key={dayIso} className="flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-ink-faint truncate w-full text-center">
                {shortWeekday(dayIso)}
              </span>
              <div
                className={cn(
                  'h-8 w-full rounded-md transition-colors duration-snap',
                  flagged ? 'bg-caution/35 ring-1 ring-caution/60' : 'bg-bg-sunken',
                )}
                title={
                  flagged
                    ? `${formatDisplayDate(dayIso)} — load risk`
                    : formatDisplayDate(dayIso)
                }
                data-flagged={flagged ? 'true' : 'false'}
              />
              <span className="text-[10px] tabular-nums text-ink-faint">
                {new Date(`${dayIso}T12:00:00Z`).getUTCDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LoadRiskSection: React.FC<LoadRiskSectionProps> = ({
  delayedTax,
  activityClasses,
}) => {
  if (delayedTax === undefined) {
    return null;
  }

  const proactiveHits = proactiveLoadRiskHits(delayedTax.hits);
  const barModels = buildLoadRiskBarModels(delayedTax.hits, activityClasses);
  const flaggedDates = new Set(
    proactiveHits
      .map((hit) => contributingDateIso(hit))
      .filter((iso): iso is string => iso != null),
  );

  return (
    <div data-testid="load-risk-section">
      <p className="text-label uppercase font-medium text-ink-muted mb-2">Load risk</p>
      <Card intent={barModels.length > 0 ? 'caution' : 'default'} pad="md">
        <LoadRiskWeekStrip
          asOf={delayedTax.asOf}
          windowDays={delayedTax.riskWindowDays}
          flaggedDates={flaggedDates}
        />

        {barModels.length > 0 ? (
          <div className="flex flex-col gap-4" data-testid="load-risk-event-bars">
            {barModels.map((row) => (
              <ProgressBar
                key={row.key}
                value={row.value}
                target={row.target}
                state={row.state}
                overshootAt={row.hitType === 'rest_debt' ? 0.99 : 1}
                dangerAt={row.hitType === 'rest_debt' ? 1 : 1.2}
                label={
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="truncate">{row.className}</span>
                    <span className="text-caption font-normal text-ink-muted">
                      {row.eventLabel} · {row.dateLabel}
                    </span>
                  </span>
                }
                valueText={
                  row.hitType === 'rest_debt'
                    ? `${row.value}/${row.target} days rest`
                    : `${row.value} vs ${row.target}`
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-muted -mt-2">{SAFE_COPY}</p>
        )}
      </Card>
    </div>
  );
};
