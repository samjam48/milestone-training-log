// =============================================================================
// EditBlockRulesScreen — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Live rule editor. Changes are applied immediately via engine.editRule —
// no separate save step required; dashboard traffic lights update instantly.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Rule } from '../../types';

interface Props {
  engine:  MilestoneEngineResult;
  onBack:  () => void;
}

// ---------------------------------------------------------------------------
// Rule metadata
// ---------------------------------------------------------------------------

interface RuleDef {
  label: string;
  unit:  string;
  min:   number;
  max:   number;
}

const RULE_DEF: Record<string, RuleDef> = {
  rest_between_class:    { label: 'Min rest between sessions', unit: 'days',     min: 1, max: 14  },
  frequency_limit:       { label: 'Max sessions per week',     unit: '×/wk',     min: 1, max: 14  },
  weekly_load_cap:       { label: 'Weekly load cap',           unit: 'load',     min: 10, max: 500 },
  consecutive_day_limit: { label: 'Max consecutive days',      unit: 'days',     min: 1, max: 7   },
  weekly_activity_count: { label: 'Max sessions per week',     unit: 'sessions', min: 1, max: 14  },
};

// ---------------------------------------------------------------------------
// RuleEditorRow
// ---------------------------------------------------------------------------

interface RuleRowProps {
  rule:            Rule;
  activityClasses: MilestoneEngineResult['activityClasses'];
  onUpdate:        MilestoneEngineResult['editRule'];
}

const RuleEditorRow: React.FC<RuleRowProps> = ({ rule, activityClasses, onUpdate }) => {
  const [localVal, setLocalVal] = React.useState(String(rule.thresholdValue));
  const cls = activityClasses.find(c => c.id === rule.activityClassId);
  const def = RULE_DEF[rule.ruleType] ?? { label: rule.ruleType, unit: '', min: 1, max: 999 };

  function step(dir: 1 | -1) {
    const next = Math.max(def.min, Math.min(def.max, rule.thresholdValue + dir));
    setLocalVal(String(next));
    onUpdate(rule.id, { thresholdValue: next });
  }

  function commitInput() {
    const n = parseFloat(localVal);
    if (!isNaN(n) && n >= def.min && n <= def.max) {
      onUpdate(rule.id, { thresholdValue: n });
    } else {
      setLocalVal(String(rule.thresholdValue));
    }
  }

  return (
    <div className="px-4 py-3.5">
      {/* Label + toggle */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-body font-medium text-ink">{def.label}</p>
          <p className="text-caption text-ink-muted mt-0.5">{cls ? cls.name : 'All classes'}</p>
        </div>
        <button
          type="button" role="switch" aria-checked={rule.enabled}
          onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
          className={cn(
            'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-snap mt-0.5',
            rule.enabled ? 'bg-safe' : 'bg-bg-sunken border border-border',
          )}
        >
          <span className={cn(
            'inline-block h-4 w-4 rounded-full shadow transition-transform duration-snap',
            rule.enabled ? 'bg-ink-inverse translate-x-5' : 'bg-ink-faint translate-x-1',
          )} />
        </button>
      </div>

      {/* Stepper — only when enabled */}
      {rule.enabled && (
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => step(-1)} disabled={rule.thresholdValue <= def.min}
            aria-label="Decrease"
            className="h-9 w-9 flex items-center justify-center rounded-md bg-bg-sunken border border-border text-body-lg font-medium text-ink-muted hover:text-ink hover:bg-bg-overlay disabled:opacity-30 transition-colors duration-snap"
          >–</button>
          <div className="flex flex-1 items-center justify-center gap-2">
            <input
              type="number" value={localVal}
              onChange={e => setLocalVal(e.target.value)}
              onBlur={commitInput}
              min={def.min} max={def.max}
              className={cn(
                'w-16 text-center rounded-md bg-bg-sunken border border-border px-2 py-1.5',
                'font-metric text-body-lg text-ink focus:outline-none focus:border-border-strong',
              )}
            />
            <span className="text-caption text-ink-muted">{def.unit}</span>
          </div>
          <button
            type="button" onClick={() => step(1)} disabled={rule.thresholdValue >= def.max}
            aria-label="Increase"
            className="h-9 w-9 flex items-center justify-center rounded-md bg-bg-sunken border border-border text-body-lg font-medium text-ink-muted hover:text-ink hover:bg-bg-overlay disabled:opacity-30 transition-colors duration-snap"
          >+</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// EditBlockRulesScreen
// ---------------------------------------------------------------------------

export const EditBlockRulesScreen: React.FC<Props> = ({ engine, onBack }) => {
  const { rules, activityClasses, editRule, block } = engine;

  const grouped = activityClasses
    .map(cls => ({ cls, clsRules: rules.filter(r => r.activityClassId === cls.id) }))
    .filter(g => g.clsRules.length > 0);

  const noClassRules = rules.filter(r => !r.activityClassId);

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
          <h1 className="text-title font-bold text-ink">Edit Rules</h1>
          {block && <p className="text-caption text-ink-muted truncate">{block.name}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="pb-10">
        <p className="px-4 pt-4 pb-2 text-caption text-ink-muted">
          Changes are live — your dashboard traffic lights update immediately.
        </p>

        {grouped.map(({ cls, clsRules }) => (
          <section key={cls.id} className="mb-6">
            <p className="px-4 pb-2 pt-2 text-label uppercase font-medium text-ink-muted">{cls.name}</p>
            <Card pad="none" className="mx-4">
              <div className="divide-y divide-border-subtle">
                {clsRules.map(rule => (
                  <RuleEditorRow
                    key={rule.id}
                    rule={rule}
                    activityClasses={activityClasses}
                    onUpdate={editRule}
                  />
                ))}
              </div>
            </Card>
          </section>
        ))}

        {noClassRules.length > 0 && (
          <section className="mb-6">
            <p className="px-4 pb-2 pt-2 text-label uppercase font-medium text-ink-muted">All Classes</p>
            <Card pad="none" className="mx-4">
              <div className="divide-y divide-border-subtle">
                {noClassRules.map(rule => (
                  <RuleEditorRow
                    key={rule.id}
                    rule={rule}
                    activityClasses={activityClasses}
                    onUpdate={editRule}
                  />
                ))}
              </div>
            </Card>
          </section>
        )}

        {rules.length === 0 && (
          <div className="mx-4">
            <Card pad="md" intent="inset">
              <p className="text-body text-ink-muted text-center py-4">
                No rules configured for this block.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
