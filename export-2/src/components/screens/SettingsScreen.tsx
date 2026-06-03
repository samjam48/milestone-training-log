// =============================================================================
// SettingsScreen — Tier 3  (v2)
// -----------------------------------------------------------------------------
// Block management, rule summary, activity list, preferences, reset.
// Previously prototype-only (preview/SettingsScreen.jsx); ported to TS in v2.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { StatusDot } from '../ui/StatusDot';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, Rule, TrainingBlock } from '../../types';

interface Props {
  engine: MilestoneEngineResult;
  onEditRules?:    () => void;
  onReview?:       () => void;
  onNewBlock?:     () => void;
  onViewBlock?:    (blockId: string) => void;
  onEditActivity?: (activity: Activity) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

const RULE_LABEL: Record<string, (v: number) => string> = {
  rest_between_class:    v => `Min ${v}-day rest`,
  frequency_limit:       v => `Max ${v}× / week`,
  weekly_load_cap:       v => `Load cap ${v} / week`,
  consecutive_day_limit: v => `Max ${v} consecutive days`,
  weekly_activity_count: v => `Max ${v} sessions / week`,
};

// ---------------------------------------------------------------------------
// BlockSummaryCard
// ---------------------------------------------------------------------------

interface BlockSummaryCardProps {
  block:           TrainingBlock;
  rules:           Rule[];
  weeklyTargets:   MilestoneEngineResult['weeklyTargets'];
  activityClasses: MilestoneEngineResult['activityClasses'];
  onEditRules?:    () => void;
  onReview?:       () => void;
}

const BlockSummaryCard: React.FC<BlockSummaryCardProps> = ({
  block, rules, weeklyTargets, activityClasses, onEditRules, onReview,
}) => {
  const classMap  = new Map(activityClasses.map(c => [c.id, c]));
  const activeRules = rules.filter(r => r.enabled);

  return (
    <Card pad="md">
      <CardHeader>
        <div className="min-w-0 flex-1">
          <CardTitle>{block.name}</CardTitle>
          <CardMeta>
            Started {fmtDate(block.startDate)}
            {block.endDate ? ` · Ends ${fmtDate(block.endDate)}` : ''}
          </CardMeta>
        </div>
        <StatusDot state="safe" size="sm" label="Active" />
      </CardHeader>

      {weeklyTargets.length > 0 && (
        <div className="mb-4">
          <p className="text-label uppercase font-medium text-ink-faint mb-2">Weekly Targets</p>
          <ul className="flex flex-col gap-1.5">
            {weeklyTargets.map(wt => {
              const cls = classMap.get(wt.activityClassId);
              return (
                <li key={wt.id} className="flex items-center justify-between gap-3 text-body">
                  <span className="text-ink-muted truncate">{cls ? cls.name : wt.activityClassId}</span>
                  <span className="font-metric tabular-nums text-ink shrink-0">
                    {wt.targetValue} {wt.targetUnit}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeRules.length > 0 && (
        <div className="mb-4 pt-3 border-t border-border-subtle">
          <p className="text-label uppercase font-medium text-ink-faint mb-2">Recovery Rules</p>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {activeRules.map(rule => {
              const cls = rule.activityClassId ? classMap.get(rule.activityClassId) : null;
              const fn  = RULE_LABEL[rule.ruleType];
              return (
                <li key={rule.id} className="flex items-center justify-between gap-3 py-2 text-body">
                  <span className="text-ink-muted truncate">{cls ? cls.name : 'All classes'}</span>
                  <span className="text-ink shrink-0">{fn ? fn(rule.thresholdValue) : rule.ruleType}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEditRules}
          className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          Edit rules
        </button>
        <button
          type="button"
          onClick={onReview}
          className="flex-1 h-10 rounded-md bg-bg-sunken border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          Review block
        </button>
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// PreferenceRow
// ---------------------------------------------------------------------------

interface PreferenceRowProps {
  label:        string;
  description?: string;
  value:        boolean;
  onChange:     (v: boolean) => void;
}

const PreferenceRow: React.FC<PreferenceRowProps> = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-3 px-4">
    <div className="min-w-0 flex-1">
      <p className="text-body font-medium text-ink">{label}</p>
      {description && <p className="text-caption text-ink-muted mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-snap',
        value ? 'bg-safe' : 'bg-bg-sunken border border-border',
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 rounded-full shadow transition-transform duration-snap',
        value ? 'bg-ink-inverse translate-x-5' : 'bg-ink-faint translate-x-1',
      )} />
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export const SettingsScreen: React.FC<Props> = ({
  engine, onEditRules, onReview, onNewBlock, onViewBlock, onEditActivity,
}) => {
  const {
    block, rules, weeklyTargets, activityClasses,
    activities, logs, previousBlocks,
    deactivateActivity, resetMockData,
  } = engine;

  const [notifications, setNotifications] = React.useState(true);
  const [metricUnits,   setMetricUnits]   = React.useState(true);
  const [resetConfirm,  setResetConfirm]  = React.useState(false);

  const lastByAct = React.useMemo(() => {
    const m: Record<string, string> = {};
    logs.forEach(l => {
      if (!m[l.activityId] || l.loggedDate > m[l.activityId]) m[l.activityId] = l.loggedDate;
    });
    return m;
  }, [logs]);

  const grouped = React.useMemo(() =>
    activityClasses
      .map(cls => ({ cls, acts: activities.filter(a => a.activityClassId === cls.id && a.isActive) }))
      .filter(g => g.acts.length > 0),
    [activityClasses, activities],
  );

  return (
    <div className="overflow-y-auto" style={{ height: 'calc(100vh - 72px)' }}>

      <div className="px-4 pt-5 pb-2">
        <h1 className="text-title font-bold text-ink">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-10">

        {/* ── Active Training Block ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">Active Block</p>
          {block ? (
            <BlockSummaryCard
              block={block}
              rules={rules}
              weeklyTargets={weeklyTargets}
              activityClasses={activityClasses}
              onEditRules={onEditRules}
              onReview={onReview}
            />
          ) : (
            <Card pad="md">
              <p className="text-body text-ink-muted">No active training block.</p>
            </Card>
          )}
        </section>

        {/* ── Previous Blocks ── */}
        {previousBlocks.length > 0 && (
          <section>
            <p className="text-label uppercase font-medium text-ink-muted mb-3">Previous Blocks</p>
            <Card pad="none">
              <div className="divide-y divide-border-subtle">
                {previousBlocks.map(pb => (
                  <div key={pb.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-ink">{pb.name}</p>
                      <p className="text-caption text-ink-muted">
                        {fmtDate(pb.startDate)} – {pb.endDate ? fmtDate(pb.endDate) : 'ongoing'}
                        {' · '}
                        <span className="text-safe-fg">Completed</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewBlock?.(pb.id)}
                      className="shrink-0 h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        <button
          type="button"
          onClick={onNewBlock}
          className="w-full h-11 rounded-md bg-bg-raised border border-border text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
        >
          + New Training Block
        </button>

        {/* ── Activities ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">Activities</p>
          <Card pad="none">
            <div className="divide-y divide-border-subtle">
              {grouped.map(({ cls, acts }) => (
                <div key={cls.id}>
                  <div className="px-4 pt-3 pb-1.5">
                    <p className="text-caption font-semibold text-ink-muted uppercase tracking-wide">
                      {cls.name}
                    </p>
                  </div>
                  {acts.map(act => {
                    const isPerf    = act.type === 'performance';
                    const typeCls   = isPerf ? 'text-caution-fg bg-caution/10' : 'text-safe-fg bg-safe/10';
                    const typeLabel = isPerf ? 'perf' : 'recovery';
                    const lastFmt   = lastByAct[act.id] ? fmtDate(lastByAct[act.id]) : 'Never';
                    return (
                      <div key={act.id} className="flex items-center gap-3 py-3 px-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-body font-medium text-ink">{act.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn('text-caption font-medium rounded-pill px-1.5 py-0.5', typeCls)}>
                              {typeLabel}
                            </span>
                            {act.defaultVolumeUnit && (
                              <span className="text-caption text-ink-faint">{act.defaultVolumeUnit}</span>
                            )}
                            <span className="text-caption text-ink-faint">· Last: {lastFmt}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEditActivity?.(act)}
                            className="h-8 px-2.5 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deactivateActivity(act.id)}
                            className="h-8 px-2.5 rounded-md text-caption font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* ── Preferences ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">Preferences</p>
          <Card pad="none">
            <div className="divide-y divide-border-subtle">
              <PreferenceRow
                label="Notifications"
                description="Daily check-in reminders"
                value={notifications}
                onChange={setNotifications}
              />
              <PreferenceRow
                label="Metric units"
                description="km, kg — toggle for imperial"
                value={metricUnits}
                onChange={setMetricUnits}
              />
            </div>
          </Card>
        </section>

        {/* ── About ── */}
        <section>
          <p className="text-label uppercase font-medium text-ink-muted mb-3">About</p>
          <Card pad="none">
            <div className="divide-y divide-border-subtle">

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-body text-ink">Version</span>
                <span className="font-metric text-body text-ink-muted tabular-nums">0.2.0</span>
              </div>

              {!resetConfirm ? (
                <button
                  type="button"
                  onClick={() => setResetConfirm(true)}
                  className="w-full flex items-center justify-between px-4 py-3 text-danger-fg hover:bg-danger/5 transition-colors duration-snap text-left"
                >
                  <span className="text-body font-medium">Reset mock data</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M8 1v4l3-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <div className="px-4 py-3 flex flex-col gap-3">
                  <p className="text-caption text-ink-muted">
                    This will reset all logs, check-ins, and goals back to the seed data. Cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setResetConfirm(false)}
                      className="flex-1 h-9 rounded-md bg-bg-sunken text-body font-medium text-ink-muted hover:bg-bg-overlay transition-colors duration-snap"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetMockData(); setResetConfirm(false); }}
                      className="flex-1 h-9 rounded-md bg-danger text-body font-semibold text-ink-inverse active:opacity-80 transition-colors duration-snap"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

            </div>
          </Card>
        </section>

      </div>
    </div>
  );
};
