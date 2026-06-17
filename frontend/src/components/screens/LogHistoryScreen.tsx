// =============================================================================
// LogHistoryScreen — Tier 3
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { DeleteButton } from '../ui/DeleteButton';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { ActivityLog, FlareUpIncident } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onOpenLogActivity?: () => void;
  onOpenLogIncident: () => void;
  onOpenNewActivity?: () => void;
  onEditLog?: (logId: string) => void;
  onDeleteLog?: (logId: string) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function weekLabel(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function mondayForWeek(iso: string): string {
  const date = new Date(iso + 'T00:00:00Z');
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().substring(0, 10);
}

function startsWeek(iso: string): boolean {
  return iso === mondayForWeek(iso);
}

function feelLabel(feel?: string): { label: string; color: string } {
  if (feel === 'mild_discomfort') return { label: 'Discomfort', color: 'text-caution-fg bg-caution/15' };
  if (feel === 'bad')             return { label: 'Bad',        color: 'text-danger-fg bg-danger/15' };
  return                                 { label: 'Fine',       color: 'text-safe-fg bg-safe/15' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cn('inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium', className)}>
    {children}
  </span>
);

const LogRow: React.FC<{
  log: ActivityLog;
  activityName: string;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ log, activityName, onEdit, onDelete }) => {
  const feel = feelLabel(log.postActivityFeel);
  const hasViolation = (log.ruleViolationsAtLog?.length ?? 0) > 0;
  const worstViolation = log.ruleViolationsAtLog?.[0];
  const showsVolume = log.volumeValue > 0 && log.volumeUnit != null && log.volumeUnit !== 'minutes';

  return (
    <div className="flex flex-col gap-2 py-3 px-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{activityName}</span>
        <Pill className={feel.color}>{feel.label}</Pill>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption text-ink-muted">{log.durationMinutes} min</span>
          {showsVolume && (
            <span className="text-caption text-ink-muted">{log.volumeValue} {log.volumeUnit}</span>
          )}
          {log.rpe && (
            <Pill className="bg-bg-sunken text-ink-muted">RPE {log.rpe}</Pill>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onEdit != null && (
            <button
              type="button"
              onClick={onEdit}
              className="text-caption font-semibold text-ink-muted hover:text-ink transition-colors duration-snap"
            >
              Edit
            </button>
          )}
          {onDelete != null && (
            <DeleteButton
              aria-label={`Delete ${activityName} log`}
              onClick={onDelete}
            />
          )}
        </div>
      </div>
      {hasViolation && worstViolation && (
        <div className={cn(
          'flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-caption',
          worstViolation.severity === 'danger' ? 'bg-danger/10 text-danger-fg' : 'bg-caution/10 text-caution-fg',
        )}>
          <span aria-hidden="true">⚠</span>
          <span>{worstViolation.message}</span>
        </div>
      )}
    </div>
  );
};

const IncidentRow: React.FC<{ incident: FlareUpIncident }> = ({ incident }) => (
  <div
    data-testid={`log-history-incident-row-${incident.id}`}
    className="flex flex-col gap-2 py-3 px-4 bg-caution/10 text-caution-fg"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">⚠</span>
        <span className="text-body font-semibold">{incident.bodyPart}</span>
      </div>
      <Pill className="bg-caution/15 text-caution-fg">
        Severity {incident.severity}/10
      </Pill>
    </div>
    {incident.notes && (
      <p className="text-caption text-ink-muted">{incident.notes}</p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Grouping logic
// ---------------------------------------------------------------------------

type TimelineItem =
  | { kind: 'incident'; incident: FlareUpIncident; sortIndex: number }
  | { kind: 'log'; log: ActivityLog; sortIndex: number };

type ByDay = Record<string, TimelineItem[]>;
type ByMonth = Record<string, ByDay>;

function timelineItemDate(item: TimelineItem): string {
  return item.kind === 'incident' ? item.incident.incidentDate : item.log.loggedDate;
}

function timelineItemKindRank(item: TimelineItem): number {
  return item.kind === 'incident' ? 0 : 1;
}

function groupTimeline(
  logs: ActivityLog[],
  incidents: FlareUpIncident[],
): { monthKeys: string[]; byMonth: ByMonth } {
  const byMonth: ByMonth = {};
  const timelineItems: TimelineItem[] = [
    ...incidents.map((incident, sortIndex) => ({ kind: 'incident' as const, incident, sortIndex })),
    ...logs.map((log, sortIndex) => ({ kind: 'log' as const, log, sortIndex })),
  ].sort((a, b) => {
    const dateComparison = timelineItemDate(b).localeCompare(timelineItemDate(a));
    if (dateComparison !== 0) return dateComparison;
    const kindComparison = timelineItemKindRank(a) - timelineItemKindRank(b);
    if (kindComparison !== 0) return kindComparison;
    return a.sortIndex - b.sortIndex;
  });

  for (const item of timelineItems) {
    const day = timelineItemDate(item);
    const month = day.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = {};
    if (!byMonth[month][day]) byMonth[month][day] = [];
    byMonth[month][day].push(item);
  }
  const monthKeys = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
  return { monthKeys, byMonth };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const LogHistoryScreen: React.FC<Props> = ({
  engine,
  onOpenLogActivity,
  onOpenLogIncident,
  onOpenNewActivity,
  onEditLog,
  onDeleteLog,
}) => {
  const { logs, activities, incidents } = engine;
  const activityMap = React.useMemo(
    () => new Map(activities.map(a => [a.id, a.name])),
    [activities],
  );
  const { monthKeys, byMonth } = React.useMemo(
    () => groupTimeline(logs, incidents),
    [incidents, logs],
  );
  const handleDeleteLog = React.useCallback((log: ActivityLog) => {
    if (onDeleteLog == null) return;
    const confirmed = window.confirm('Delete this activity log?');
    if (!confirmed) return;
    void onDeleteLog(log.id);
  }, [onDeleteLog]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-title font-bold text-ink">Log History</h1>
        <p className="text-caption text-ink-muted mt-0.5">{logs.length} sessions logged</p>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {monthKeys.length === 0 ? (
          <div
            data-testid="log-history-empty-state"
            className="flex flex-col items-center justify-center gap-3 text-center mt-8 px-2"
          >
            <div
              data-testid="log-history-empty-illustration"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-sunken text-ink-faint"
              aria-hidden="true"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.75" />
                <path d="M14 14h12M14 20h12M14 26h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-body text-ink-muted">No sessions logged yet.</p>
            <p className="text-body text-ink-muted">Create an activity to start logging.</p>
            {onOpenLogActivity != null && (
              <button
                type="button"
                onClick={onOpenLogActivity}
                className="mt-1 text-caption font-semibold text-ink underline hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded"
              >
                Log your first session
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {monthKeys.map(month => {
              const monthData = byMonth[month];
              if (!monthData) return null;
              const dayKeys = Object.keys(monthData).sort((a, b) => b.localeCompare(a));
              const weekCount = new Set(dayKeys.map(mondayForWeek)).size;
              return (
                <section key={month}>
                  {/* Month header */}
                  <p className="text-label uppercase font-semibold text-ink-muted mb-2">
                    {monthLabel(month + '-01')}
                  </p>
                  <Card pad="none">
                    <div className="flex flex-col gap-2 p-2">
                      {dayKeys.map((day, index) => {
                        const previousDay = dayKeys[index - 1];
                        const startsNewVisibleWeek =
                          previousDay != null && mondayForWeek(day) !== mondayForWeek(previousDay);

                        return (
                          <React.Fragment key={day}>
                            {weekCount > 1 && index > 0 && (startsWeek(day) || startsNewVisibleWeek) && (
                              <div className="px-1 pt-1 text-caption font-semibold text-ink-muted">
                                Week of {weekLabel(mondayForWeek(day))}
                              </div>
                            )}
                            <div
                              data-testid={`log-history-day-group-${day}`}
                              className="rounded-md border border-border-subtle bg-bg-sunken p-2"
                            >
                              {/* Day sub-header */}
                              <div className="px-2 pt-0.5 pb-1">
                                <span className="text-caption font-medium text-ink-muted">
                                  {dayLabel(day)}
                                </span>
                              </div>
                              <div className="divide-y divide-border-subtle overflow-hidden rounded-sm bg-bg-raised">
                                {(monthData[day] ?? []).map(item => {
                                  if (item.kind === 'incident') {
                                    return (
                                      <IncidentRow
                                        key={`incident-${item.incident.id}`}
                                        incident={item.incident}
                                      />
                                    );
                                  }

                                  return (
                                    <LogRow
                                      key={`log-${item.log.id}`}
                                      log={item.log}
                                      activityName={activityMap.get(item.log.activityId) ?? 'Unknown'}
                                      onEdit={
                                        onEditLog != null
                                          ? () => onEditLog(item.log.id)
                                          : undefined
                                      }
                                      onDelete={
                                        onDeleteLog != null
                                          ? () => handleDeleteLog(item.log)
                                          : undefined
                                      }
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </Card>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        data-testid="bottom-action-bar"
        className="shrink-0 border-t border-border bg-bg-raised px-4 py-3 flex flex-col gap-2"
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onOpenLogActivity}
            className="flex-1 h-11 rounded-md bg-ink text-ink-inverse text-body font-semibold transition-colors duration-snap active:bg-ink/80"
          >
            + Log Activity
          </button>
          <button
            type="button"
            onClick={onOpenLogIncident}
            className="flex-1 h-11 rounded-md bg-danger/15 text-danger-fg text-body font-semibold border border-danger-border transition-colors duration-snap active:bg-danger/25"
          >
            + Log Incident
          </button>
        </div>
        {onOpenNewActivity != null && (
          <button
            type="button"
            onClick={onOpenNewActivity}
            className="w-full h-11 rounded-md bg-bg-raised border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
          >
            + New Activity
          </button>
        )}
      </div>
    </div>
  );
};
