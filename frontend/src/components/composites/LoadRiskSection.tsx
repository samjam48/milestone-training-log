// =============================================================================
// LoadRiskSection — rule-limit load risk from dashboard load_risk_summary (WTL.F5)
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import type { LoadRiskRuleLimitRow, LoadRiskSummary } from '../../lib/engine';
import type { SafetyState } from '../../types';

const NO_SUMMARY_COPY = 'No load caps configured.';
const NO_RULES_COPY = 'No load rules are configured.';

function formatActualLimit(actual: number, limit: number, unit: string): string {
  const roundedActual = Number.isInteger(actual) ? actual : Math.round(actual * 10) / 10;
  const roundedLimit = Number.isInteger(limit) ? limit : Math.round(limit * 10) / 10;
  return `${roundedActual} / ${roundedLimit} ${unit}`;
}

function dayCellClasses(state: SafetyState): string {
  switch (state) {
    case 'danger':
      return 'bg-danger/35 ring-1 ring-danger/60';
    case 'caution':
      return 'bg-caution/35 ring-1 ring-caution/60';
    default:
      return 'bg-bg-sunken';
  }
}

function groupRuleRowsByClass(
  rows: LoadRiskRuleLimitRow[],
): { activityClassId: string; className: string; rows: LoadRiskRuleLimitRow[] }[] {
  const groups: {
    activityClassId: string;
    className: string;
    rows: LoadRiskRuleLimitRow[];
  }[] = [];
  const indexByClass = new Map<string, number>();

  for (const row of rows) {
    let groupIndex = indexByClass.get(row.activityClassId);
    if (groupIndex === undefined) {
      groupIndex = groups.length;
      indexByClass.set(row.activityClassId, groupIndex);
      groups.push({
        activityClassId: row.activityClassId,
        className: row.className,
        rows: [],
      });
    }
    groups[groupIndex]!.rows.push(row);
  }

  return groups;
}

function ruleRowLabel(row: LoadRiskRuleLimitRow): React.ReactNode {
  if (row.scope === 'activity' && row.activityName) {
    return <span className="truncate">{row.activityName}</span>;
  }
  return <span className="truncate">{row.label}</span>;
}

/**
 * Returns a period prefix for bar-mode rule rows, derived from ruleType only.
 * daily_volume_cap → "Daily:"
 * weekly_volume_cap | weekly_load_cap | frequency_limit → "Weekly:"
 * All others → null (no prefix)
 */
function rulePeriodPrefix(ruleType: string): 'Daily:' | 'Weekly:' | null {
  if (ruleType === 'daily_volume_cap') return 'Daily:';
  if (
    ruleType === 'weekly_volume_cap' ||
    ruleType === 'weekly_load_cap' ||
    ruleType === 'frequency_limit'
  )
    return 'Weekly:';
  return null;
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
            dayCellClasses(day.state),
          )}
          data-state={day.state}
          data-flagged={day.flagged ? 'true' : 'false'}
          title={day.date}
        />
      ))}
    </div>
  </div>
);

const LoadRiskRuleRow: React.FC<{ row: LoadRiskRuleLimitRow }> = ({ row }) => {
  const scopeProps =
    row.scope === 'activity'
      ? { 'data-scope': 'activity' as const, 'data-activity-id': row.activityId ?? undefined }
      : { 'data-scope': 'class' as const };

  if (row.displayMode === 'status') {
    return (
      <div
        data-testid={`load-risk-rule-row-${row.id}`}
        data-display-mode="status"
        {...scopeProps}
        className="rounded-md"
      >
        <p className="text-body text-ink">{row.label}</p>
      </div>
    );
  }

  const prefix = rulePeriodPrefix(row.ruleType);
  const baseValueText = formatActualLimit(row.actual, row.limit, row.unit);
  const valueText = prefix !== null ? `${prefix} ${baseValueText}` : baseValueText;

  return (
    <div
      data-testid={`load-risk-rule-row-${row.id}`}
      data-display-mode="bar"
      {...scopeProps}
    >
      <ProgressBar
        value={row.actual}
        target={row.limit}
        state={row.state}
        overshootAt={0.99}
        dangerAt={1}
        label={ruleRowLabel(row)}
        valueText={valueText}
      />
    </div>
  );
};

export interface LoadRiskSectionProps {
  loadRiskSummary: LoadRiskSummary | null;
}

export const LoadRiskSection: React.FC<LoadRiskSectionProps> = ({ loadRiskSummary }) => {
  if (loadRiskSummary == null) {
    return (
      <div data-testid="load-risk-section">
        <p className="text-label uppercase font-medium text-ink-muted mb-2">Load risk</p>
        <Card pad="md">
          <p className="text-caption text-ink-muted">{NO_SUMMARY_COPY}</p>
        </Card>
      </div>
    );
  }

  const { weekDays, ruleLimitRows } = loadRiskSummary;
  const hasRuleRows = ruleLimitRows.length > 0;
  const classGroups = groupRuleRowsByClass(ruleLimitRows);
  const hasRisk =
    weekDays.some((day) => day.state !== 'safe') ||
    ruleLimitRows.some((row) => row.state !== 'safe');

  return (
    <div data-testid="load-risk-section">
      <p className="text-label uppercase font-medium text-ink-muted mb-2">Load risk</p>
      <Card intent={hasRisk ? 'caution' : 'default'} pad="md">
        <LoadRiskWeekStrip weekDays={weekDays} />

        {hasRuleRows ? (
          <div className="flex flex-col gap-4" data-testid="load-risk-rule-rows">
            {classGroups.map((group) => (
              <div
                key={group.activityClassId}
                data-testid={`load-risk-class-group-${group.activityClassId}`}
                className="flex flex-col gap-3"
              >
                <p className="text-body font-medium text-ink truncate">{group.className}</p>
                {group.rows.map((row) => (
                  <LoadRiskRuleRow key={row.id} row={row} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-caption text-ink-muted -mt-2">{NO_RULES_COPY}</p>
        )}
      </Card>
    </div>
  );
};
