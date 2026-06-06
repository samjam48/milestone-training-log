// =============================================================================
// DashboardScreen — Tier 3
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusDot } from '../ui/StatusDot';
import { SuggestedActivityCard } from '../composites/SuggestedActivityCard';
import { WeeklyLoadGraph } from '../composites/WeeklyLoadGraph';
import { BlockSafetyMapSection } from '../composites/BlockSafetyMapSection';
import { LoadRiskSection } from '../composites/LoadRiskSection';
import { GoalsCard } from '../composites/GoalsCard';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, ActivityClass, RecoveryStreak, SafetyState } from '../../types';

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

function formatRecoveryStreakCopy(streak: RecoveryStreak): string {
  const { activityName, frequencyUnit, currentStreakDays } = streak;
  if (frequencyUnit === 'weekly') {
    const weekWord = currentStreakDays === 1 ? 'week' : 'weeks';
    return `${activityName}: ${currentStreakDays} ${weekWord} in a row`;
  }
  const dayWord = currentStreakDays === 1 ? 'day' : 'days';
  return `${activityName}: ${currentStreakDays} ${dayWord} in a row`;
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

const StreakRow: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex items-center gap-3 py-2.5">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-safe/15">
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 7l3.5 3.5L12 3" stroke="#3DD68C" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
    <div>
      <p className="text-body font-medium text-ink">{count} clean session{count === 1 ? '' : 's'} in a row</p>
      <p className="text-caption text-ink-muted">No rule violations or reported bad sessions</p>
    </div>
  </div>
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
    suggestions, weeklyProgress, classStatuses,
    loadSeries, graphClassId, flareUpDates, weekLoadThreshold, cleanStreak, recoveryStreaks,
    block, activityClasses, activities, delayedTax,
    goalRows,
  } = engine;

  const weeklyLoadGraphTitle = loadGraphTitle(graphClassId, activityClasses);

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-4">
      {/* ── Greeting header ── */}
      <div>
        <h1 className="text-heading font-bold text-ink">Good morning, {userName}.</h1>
        <p className="text-body text-ink-muted mt-0.5">{formatDay(todayDate)}</p>
      </div>

      {/* ── Check-in CTA ── */}
      {!hasCheckedInToday && <CheckInCTA onPress={onOpenCheckIn} />}

      {/* ── Suggested activities ── */}
      <SuggestedActivityCard
        suggestions={suggestions}
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

      {/* ── Last 7 days: weekly targets ── */}
      <div>
        <SectionLabel>Last 7 days</SectionLabel>
        <Card pad="md">
          <div className="flex flex-col gap-4">
            {weeklyProgress.map(wp => (
              <ProgressBar
                key={wp.weeklyTargetId}
                value={wp.value}
                target={wp.target}
                state={wp.state as SafetyState | 'neutral'}
                label={wp.className}
                valueText={`${progressLabel(wp.value, wp.unit)} / ${progressLabel(wp.target, wp.unit)}`}
              />
            ))}
          </div>
        </Card>
      </div>

      <GoalsCard goalRows={goalRows} />

      {/* ── Recovery streaks ── */}
      {block.id ? (
        <div>
          <SectionLabel>Recovery streaks</SectionLabel>
          <Card pad="sm">
            {recoveryStreaks.length === 0 ? (
              <p className="text-caption text-ink-muted py-2.5">
                No recovery targets in this block.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle">
                {recoveryStreaks.map((streak) => (
                  <li
                    key={streak.recoveryTargetId}
                    className="py-2.5 text-body font-medium text-ink truncate"
                  >
                    {formatRecoveryStreakCopy(streak)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {/* ── Load graph ── */}
      <WeeklyLoadGraph
        startDate={block.startDate}
        endDate={todayDate}
        series={loadSeries}
        threshold={weekLoadThreshold}
        flareUpDates={flareUpDates}
        title={weeklyLoadGraphTitle}
        subtitle="Rolling 7-day · full block"
      />

      <LoadRiskSection delayedTax={delayedTax} activityClasses={activityClasses} />

      {/* ── Block safety map ── */}
      <BlockSafetyMapSection engine={engine} />

      {/* ── Activity class status ── */}
      <div>
        <SectionLabel>Activity status</SectionLabel>
        <Card pad="none">
          <ul className="divide-y divide-border-subtle">
            {classStatuses.map(cs => (
              <li key={cs.activityClassId} className="flex items-center justify-between gap-3 px-4 py-3">
                <StatusDot
                  state={cs.state}
                  label={classStatusLabel(cs.activityClassId, activityClasses)}
                  meta={cs.reason}
                />
                {cs.nextSafeDate && (
                  <span className="text-caption text-ink-faint shrink-0">Safe {formatShort(cs.nextSafeDate)}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── Clean streak ── */}
      <div>
        <SectionLabel>Clean streak</SectionLabel>
        <Card pad="sm">
          <StreakRow count={cleanStreak} />
        </Card>
      </div>
    </div>
  );
};
