import * as React from 'react';
import { Card } from '../ui/Card';
import { SuggestedActivityCard } from '../composites/SuggestedActivityCard';
import { allWeeklyTargetsComplete } from '../../lib/engine';
import { overallLoadRiskState } from '../../lib/load';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, SafetyState } from '../../types';

interface DashboardTodayTabProps {
  engine: MilestoneEngineResult;
  onOpenCheckIn: () => void;
  onOpenLogActivity: (activityId?: string) => void;
  onQuickLog?: (activity: Activity) => void;
}

function formatDay(iso: string): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function todayLoadRiskCopy(state: SafetyState): { title: string; detail: string } {
  switch (state) {
    case 'danger':
      return {
        title: 'High load risk',
        detail: 'Choose recovery or a lighter session before adding more load.',
      };
    case 'caution':
      return {
        title: 'Load risk rising',
        detail: 'Keep the next session light and watch how symptoms respond.',
      };
    default:
      return {
        title: 'Load risk steady',
        detail: 'Your recent load is within the current safety rules.',
      };
  }
}

function CheckInCTA({ onPress }: { onPress: () => void }) {
  return (
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
          <p className="text-caption text-ink-muted mt-0.5">
            Log pain, readiness and stiffness to update your traffic lights.
          </p>
        </div>
        <ChevronRight className="shrink-0 text-info-fg" />
      </div>
    </Card>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M7.5 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TodayLoadRiskIndicator({ engine }: { engine: MilestoneEngineResult }) {
  const state = overallLoadRiskState(engine.loadRiskSummary);
  const copy = todayLoadRiskCopy(state);
  const intent = state === 'danger' ? 'danger' : state === 'caution' ? 'caution' : 'safe';

  return (
    <Card intent={intent} pad="md" data-testid="dashboard-today-load-risk-indicator">
      <p className="text-label uppercase font-medium text-ink-muted mb-1">At a glance</p>
      <p className="text-body-lg font-semibold text-ink">{copy.title}</p>
      <p className="text-caption text-ink-muted mt-0.5">{copy.detail}</p>
    </Card>
  );
}

export const DashboardTodayTab: React.FC<DashboardTodayTabProps> = ({
  engine,
  onOpenCheckIn,
  onOpenLogActivity,
  onQuickLog,
}) => {
  const {
    todayDate,
    userName,
    hasCheckedInToday,
    suggestionBuckets,
    weeklyProgress,
    activities,
  } = engine;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading font-bold text-ink">Good morning, {userName}.</h1>
        <p className="text-body text-ink-muted mt-0.5">{formatDay(todayDate)}</p>
      </div>

      {hasCheckedInToday === true ? (
        <Card intent="safe" pad="md">
          <p className="text-body-lg font-semibold text-safe-fg">Check-in complete</p>
          <p className="text-caption text-ink-muted mt-0.5">Logged today</p>
        </Card>
      ) : (
        <CheckInCTA onPress={onOpenCheckIn} />
      )}

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

      <TodayLoadRiskIndicator engine={engine} />
    </div>
  );
};
