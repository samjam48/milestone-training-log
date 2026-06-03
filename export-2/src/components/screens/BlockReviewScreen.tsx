// =============================================================================
// BlockReviewScreen — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Read-only review of a training block: summary stats + charts.
// Shows the active block (with live charts) or a previous block (stats only).
// =============================================================================

import * as React from 'react';
import { Card } from '../ui/Card';
import { CalendarHeatmap } from '../composites/CalendarHeatmap';
import { WeeklyLoadGraph } from '../composites/WeeklyLoadGraph';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';

interface Props {
  engine:   MilestoneEngineResult;
  onBack:   () => void;
  blockId?: string;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

interface StatBoxProps {
  value:  string | number;
  label:  string;
  state?: 'neutral' | 'safe' | 'danger';
}

const StatBox: React.FC<StatBoxProps> = ({ value, label, state = 'neutral' }) => {
  const colorCls = state === 'safe' ? 'text-safe-fg' : state === 'danger' ? 'text-danger-fg' : 'text-ink';
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span className={`font-metric tabular-nums leading-none text-[40px] ${colorCls}`}>{value}</span>
      <span className="text-caption text-ink-muted text-center">{label}</span>
    </div>
  );
};

export const BlockReviewScreen: React.FC<Props> = ({ engine, onBack, blockId }) => {
  const {
    block, previousBlocks, dailyScores, loadSeries,
    flareUpDates, weekLoadThreshold, logs, todayDate,
  } = engine;

  const targetBlock = blockId
    ? (previousBlocks.find(b => b.id === blockId) ?? block)
    : block;

  const isActive = targetBlock?.id === block?.id;

  const blockLogs = React.useMemo(() => {
    if (!targetBlock) return [];
    return logs.filter(l =>
      l.loggedDate >= targetBlock.startDate &&
      (!targetBlock.endDate || l.loggedDate <= targetBlock.endDate),
    );
  }, [logs, targetBlock]);

  const stats = React.useMemo(() => {
    const totalSessions = blockLogs.length;
    const cleanSessions = blockLogs.filter(l =>
      l.postActivityFeel !== 'bad' &&
      !(l.ruleViolationsAtLog ?? []).some(v => v.severity === 'danger'),
    ).length;
    return { totalSessions, cleanSessions };
  }, [blockLogs]);

  const safeDays   = dailyScores.filter(d => d.state === 'safe').length;
  const dangerDays = dailyScores.filter(d => d.state === 'danger').length;

  if (!targetBlock) return null;

  const endDisplay = targetBlock.endDate ?? todayDate;

  return (
    <div className="flex flex-col bg-bg" style={{ minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border shrink-0">
        <button
          type="button" onClick={onBack} aria-label="Back"
          className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-title font-bold text-ink truncate">{targetBlock.name}</h1>
          <p className="text-caption text-ink-muted mt-0.5">
            {fmtDate(targetBlock.startDate)} – {fmtDate(endDisplay)}
            {isActive && <span className="ml-2 text-safe-fg">Active</span>}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 flex flex-col gap-5 pb-10">

        {/* Summary stats */}
        <Card pad="md">
          <div className="grid grid-cols-4 gap-2 divide-x divide-border-subtle">
            <StatBox value={stats.totalSessions} label="Sessions" />
            <StatBox value={stats.cleanSessions} label="Clean"     state="safe" />
            <StatBox value={safeDays}             label="Safe days" state="safe" />
            <StatBox value={dangerDays}           label="Flares"    state={dangerDays > 0 ? 'danger' : 'neutral'} />
          </div>
        </Card>

        {/* Charts — active block only */}
        {isActive && (
          <>
            <CalendarHeatmap
              startDate={targetBlock.startDate}
              endDate={endDisplay}
              scores={dailyScores.filter(d => d.state !== 'neutral')}
              title="Safety Map"
            />
            <WeeklyLoadGraph
              startDate={targetBlock.startDate}
              endDate={todayDate}
              series={loadSeries}
              threshold={weekLoadThreshold}
              flareUpDates={flareUpDates}
              title="Foot Load"
              subtitle="Rolling 7-day · full block"
            />
          </>
        )}

        {!isActive && (
          <Card pad="md" intent="inset">
            <p className="text-body text-ink-muted text-center py-6">
              Detailed charts are only available for the active block.
            </p>
          </Card>
        )}

      </div>
    </div>
  );
};
