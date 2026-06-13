// =============================================================================
// DashboardScreen — Tier 3
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusDot } from '../ui/StatusDot';
import { SuggestedActivityCard } from '../composites/SuggestedActivityCard';
import { WeeklyLoadGraph, LOAD_GRAPH_SUBTITLE, LOAD_GRAPH_WINDOW_DAYS } from '../composites/WeeklyLoadGraph';
import { addDays } from '../../lib/load';
import { BlockSafetyMapSection } from '../composites/BlockSafetyMapSection';
import { LoadRiskSection } from '../composites/LoadRiskSection';
import { GoalsCard } from '../composites/GoalsCard';
import { allWeeklyTargetsComplete } from '../../lib/engine';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { ClassWeeklySummary } from '../../lib/engine';
import type { Activity, ActivityClass, SafetyState } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onOpenCheckIn: () => void;
  onOpenLogActivity: (activityId?: string) => void;
  onQuickLog?: (activity: Activity) => void;
}

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------

function formatDay(iso: string): string {
  const dt = new Date(iso + 'T00:00:00Z');
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function formatShort(iso: string): string {
  const dt = new Date(iso + 'T00:00:00Z');
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
  return `${formatShort(start)} – ${formatShort(end)}`;
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cn('text-label uppercase font-medium text-ink-muted mb-2', className)}>{children}</p>
);

const CheckInCTA: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <Card
    intent="info"
    pad="md"
    interactive
    onClick={onPress}
    role="button"
    aria-label="Complete morning check-in"
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-body-lg font-semibold text-info-fg">Morning check-in</p>
        <p className="text-caption text-ink-muted mt-0.5">Log pain, readiness and stiffness to update your traffic lights.</p>
      </div>
      <ChevronRight className="shrink-0 text-info-fg" />
    </div>
  </Card>
);

const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg width={20} height={20} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export const DashboardScreen: React.FC<Props> = ({
  engine,
  onOpenCheckIn,
  onOpenLogActivity,
  onQuickLog,
}) => {
  const {
    todayDate, userName, hasCheckedInToday,
    suggestionBuckets, weeklyProgress, classStatuses,
    loadSeries, graphClassId, flareUpDates, weekLoadThreshold,
    activityClasses, activities, loadRiskSummary,
    goalRows, classWeeklySummaries,
  } = engine;

  const weeklyLoadGraphTitle = loadGraphTitle(graphClassId, activityClasses);
  const loadGraphStartDate = addDays(todayDate, -(LOAD_GRAPH_WINDOW_DAYS - 1));

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-4">
      {/* ── Greeting header ── */}
      <div>
        <h1 className="text-heading font-bold text-ink">Good morning, {userName}.</h1>
        <p className="text-body text-ink-muted mt-0.5">{formatDay(todayDate)}</p>
      </div>

      {/* ── Check-in CTA ── */}
      {hasCheckedInToday === true ? (
        <Card intent="safe" pad="md">
          <p className="text-body-lg font-semibold text-safe-fg">Check-in complete</p>
          <p className="text-caption text-ink-muted mt-0.5">Logged today</p>
        </Card>
      ) : (
        <CheckInCTA onPress={onOpenCheckIn} />
      )}

      {/* ── Suggested activities ── */}
      <SuggestedActivityCard
        suggestionBuckets={suggestionBuckets}
        allWeeklyTargetsComplete={allWeeklyTargetsComplete(weeklyProgress)}
        onPick={(s) => {
          const activity = activities.find((candidate) => candidate.id === s.id);
          if (activity != null && onQuickLog != null) {
            onQuickLog(activity);
          } else if (onQuickLog == null) {
            onOpenLogActivity(s.id);
          }
        }}
        asOf="Today"
      />

      {/* ── This week: weekly targets ── */}
      <div>
        <SectionLabel>This week</SectionLabel>
        {weeklyProgress[0]?.periodStart != null && weeklyProgress[0]?.periodEnd != null ? (
          <p className="text-caption text-ink-muted -mt-1 mb-2">
            {formatWeekPeriod(weeklyProgress[0].periodStart, weeklyProgress[0].periodEnd)}
          </p>
        ) : null}
        <Card pad="md">
          {weeklyProgress.length === 0 ? (
            <p className="text-caption text-ink-muted">No weekly targets configured.</p>
          ) : (
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
          )}
        </Card>
      </div>

      <GoalsCard goalRows={goalRows} />

      {/* ── Load graph ── */}
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

      {/* ── Block safety map ── */}
      <BlockSafetyMapSection engine={engine} />

      {/* ── Activity class status ── */}
      <div>
        <SectionLabel>Activity status</SectionLabel>
        <Card pad="none">
          <ul className="divide-y divide-border-subtle">
            {classStatuses.map(cs => {
              const summary = classWeeklySummaries?.find(s => s.activityClassId === cs.activityClassId);
              const name = classStatusLabel(cs.activityClassId, activityClasses);
              const title = classTitleWithVolume(name, summary);
              const isSafe = cs.state === 'safe';
              const secondaryLine = isSafe
                ? sessionCountLine(summary?.sessionCount ?? 0)
                : cs.reason;
              return (
                <li key={cs.activityClassId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <StatusDot
                    state={cs.state}
                    label={title}
                    meta={secondaryLine}
                  />
                  {cs.nextSafeDate && (
                    <span className="text-caption text-ink-faint shrink-0">Safe {formatShort(cs.nextSafeDate)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

    </div>
  );
};
