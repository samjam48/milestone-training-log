import * as React from 'react';
import { Card } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';
import { WeeklyLoadGraph, LOAD_GRAPH_SUBTITLE, LOAD_GRAPH_WINDOW_DAYS } from '../composites/WeeklyLoadGraph';
import { BlockSafetyMapSection } from '../composites/BlockSafetyMapSection';
import { LoadRiskSection } from '../composites/LoadRiskSection';
import { addDays } from '../../lib/load';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';
import type { ClassWeeklySummary } from '../../lib/engine';

interface DashboardSafetyTabProps {
  engine: MilestoneEngineResult;
  onViewSettings?: () => void;
}

function formatShort(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function loadGraphTitle(
  graphClassId: string | null,
  activityClasses: ActivityClass[],
): string {
  if (graphClassId === null) {
    return 'Weekly load';
  }
  return activityClasses.find((c) => c.id === graphClassId)?.name ?? 'Unknown class';
}

function classStatusLabel(
  activityClassId: string,
  activityClasses: ActivityClass[],
): string {
  return activityClasses.find((c) => c.id === activityClassId)?.name ?? 'Unknown class';
}

function sessionCountLine(count: number): string {
  return `${count} ${count === 1 ? 'session' : 'sessions'} this week`;
}

function classTitleWithVolume(name: string, summary: ClassWeeklySummary | undefined): string {
  if (!summary || summary.sessionCount === 0 || !summary.totalVolume || !summary.volumeUnit) {
    return name;
  }
  return `${name} · ${summary.totalVolume} ${summary.volumeUnit}`;
}

function daysUntilSafe(todayDate: string, nextSafeDate: string): number {
  const today = new Date(`${todayDate}T00:00:00Z`).getTime();
  const nextSafe = new Date(`${nextSafeDate}T00:00:00Z`).getTime();
  const days = Math.ceil((nextSafe - today) / 86_400_000);
  return Math.max(0, days);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-label uppercase font-medium text-ink-muted mb-2">{children}</p>;
}

export const DashboardSafetyTab: React.FC<DashboardSafetyTabProps> = ({
  engine,
  onViewSettings,
}) => {
  const {
    todayDate,
    classStatuses,
    loadSeries,
    graphClassId,
    flareUpDates,
    weekLoadThreshold,
    activityClasses,
    loadRiskSummary,
    classWeeklySummaries,
  } = engine;
  const weeklyLoadGraphTitle = loadGraphTitle(graphClassId, activityClasses);
  const loadGraphStartDate = addDays(todayDate, -(LOAD_GRAPH_WINDOW_DAYS - 1));
  const [expandedClassStatusId, setExpandedClassStatusId] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <WeeklyLoadGraph
        startDate={loadGraphStartDate}
        endDate={todayDate}
        series={loadSeries}
        threshold={weekLoadThreshold}
        flareUpDates={flareUpDates}
        title={weeklyLoadGraphTitle}
        subtitle={LOAD_GRAPH_SUBTITLE}
      />

      <LoadRiskSection loadRiskSummary={loadRiskSummary} />

      <BlockSafetyMapSection engine={engine} />

      <div>
        <SectionLabel>Activity status</SectionLabel>
        {classStatuses.length === 0 ? (
          <Card intent="info" pad="md" data-testid="activity-status-empty-state">
            <p className="text-body text-info-fg font-medium">No activities tracked</p>
            <p className="text-caption text-ink-muted mt-0.5">
              Add activities to see your readiness at a glance.
            </p>
            {onViewSettings != null && (
              <button
                type="button"
                onClick={onViewSettings}
                className="mt-3 text-caption font-semibold text-info-fg underline hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-fg rounded"
              >
                Set up activities
              </button>
            )}
          </Card>
        ) : (
          <Card pad="none">
            <ul className="divide-y divide-border-subtle">
              {classStatuses.map((cs) => {
                const summary = classWeeklySummaries?.find(
                  (s) => s.activityClassId === cs.activityClassId,
                );
                const name = classStatusLabel(cs.activityClassId, activityClasses);
                const title = classTitleWithVolume(name, summary);
                const isSafe = cs.state === 'safe';
                const secondaryLine = isSafe
                  ? sessionCountLine(summary?.sessionCount ?? 0)
                  : cs.reason;
                const isExpanded = expandedClassStatusId === cs.activityClassId;
                const detailId = `activity-status-detail-${cs.activityClassId}`;
                const restDaysRemaining = cs.nextSafeDate
                  ? daysUntilSafe(todayDate, cs.nextSafeDate)
                  : null;
                return (
                  <li key={cs.activityClassId}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-snap ease-out-quint hover:bg-bg-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-fg"
                      aria-expanded={isExpanded}
                      aria-controls={detailId}
                      onClick={() => {
                        setExpandedClassStatusId(isExpanded ? null : cs.activityClassId);
                      }}
                    >
                      <StatusDot
                        state={cs.state}
                        label={title}
                        meta={isExpanded && !isSafe ? undefined : secondaryLine}
                      />
                      {cs.nextSafeDate && (
                        <span className="text-caption text-ink-faint shrink-0">
                          Safe {formatShort(cs.nextSafeDate)}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div id={detailId} className="px-4 pb-3 pl-11">
                        <p className="text-caption text-ink-muted">{cs.reason}</p>
                        {restDaysRemaining !== null && (
                          <p className="text-caption font-medium text-ink mt-1">
                            {restDaysRemaining} rest {restDaysRemaining === 1 ? 'day' : 'days'} remaining
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};
