// =============================================================================
// ActivityManagerScreen — Tier 3  (v2 new)
// -----------------------------------------------------------------------------
// Edit name / class / type / unit for an existing activity, or deactivate it.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity, VolumeUnit, ActivityType } from '../../types';

interface Props {
  activity:   Activity;
  engine:     MilestoneEngineResult;
  onBack:     () => void;
  onComplete: () => void;
}

const TYPE_OPTS: Array<{ value: ActivityType; label: string; tone: 'neutral' }> = [
  { value: 'performance', label: 'Performance', tone: 'neutral' },
  { value: 'recovery',    label: 'Recovery',    tone: 'neutral' },
];

const UNIT_OPTS: VolumeUnit[] = ['km', 'mi', 'minutes', 'reps', 'sets', 'sessions'];

export const ActivityManagerScreen: React.FC<Props> = ({
  activity, engine, onBack, onComplete,
}) => {
  const { activityClasses, editActivity, deactivateActivity } = engine;

  const [name,        setName]        = React.useState(activity.name);
  const [classId,     setClassId]     = React.useState(activity.activityClassId);
  const [type,        setType]        = React.useState<ActivityType>(activity.type);
  const [unit,        setUnit]        = React.useState<VolumeUnit>(activity.defaultVolumeUnit ?? 'km');
  const [showConfirm, setShowConfirm] = React.useState(false);

  const canSave = name.trim().length > 0 && classId.length > 0;

  function handleSave() {
    if (!canSave) return;
    editActivity(activity.id, {
      name: name.trim(),
      activityClassId: classId,
      type,
      defaultVolumeUnit: unit,
    });
    onComplete();
  }

  function handleDeactivate() {
    deactivateActivity(activity.id);
    onComplete();
  }

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
        <h1 className="text-title font-bold text-ink flex-1">Edit Activity</h1>
        <button
          type="button" onClick={handleSave} disabled={!canSave}
          className={cn(
            'h-9 px-4 rounded-md text-body font-semibold transition-colors duration-snap',
            canSave ? 'bg-ink text-ink-inverse' : 'bg-ink/20 text-ink-faint cursor-not-allowed',
          )}
        >
          Save
        </button>
      </div>

      {/* Form */}
      <div className="px-4 py-5 flex flex-col gap-5 pb-12">

        {/* Name */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Activity name</p>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            className={cn(
              'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
              'text-body text-ink focus:outline-none focus:border-border-strong',
            )}
          />
        </div>

        {/* Class */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Activity class</p>
          <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
            {activityClasses.map(cls => {
              const sel = classId === cls.id;
              return (
                <button key={cls.id} type="button" onClick={() => setClassId(cls.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                    sel ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                  )}
                >
                  <div className="min-w-0">
                    <p className={cn('text-body font-medium', sel ? 'text-ink' : 'text-ink-muted')}>{cls.name}</p>
                    <p className="text-caption text-ink-faint capitalize">{cls.type}</p>
                  </div>
                  {sel && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
                      <path d="M3 8l3.5 3.5L13 4" stroke="#E8ECF1" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Type</p>
          <SegmentedControl
            value={type}
            onChange={v => setType(v as ActivityType)}
            options={TYPE_OPTS}
            ariaLabel="Activity type"
          />
        </div>

        {/* Volume unit */}
        <div>
          <p className="text-body font-medium text-ink mb-2">Volume unit</p>
          <div className="grid grid-cols-3 gap-1.5">
            {UNIT_OPTS.map(u => (
              <button key={u} type="button" onClick={() => setUnit(u)}
                className={cn(
                  'h-9 rounded-md text-body font-medium transition-colors duration-snap border',
                  unit === u
                    ? 'bg-ink text-ink-inverse border-transparent'
                    : 'bg-bg-sunken text-ink-muted border-border hover:bg-bg-overlay',
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Deactivate */}
        <div className="pt-2">
          {!showConfirm ? (
            <button
              type="button" onClick={() => setShowConfirm(true)}
              className="w-full h-11 rounded-md border border-danger/40 text-body font-medium text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
            >
              Deactivate activity
            </button>
          ) : (
            <Card intent="danger" pad="md">
              <p className="text-body text-ink mb-3">
                Deactivating hides this activity from the log picker. All existing logs are preserved.
              </p>
              <div className="flex gap-2">
                <button
                  type="button" onClick={() => setShowConfirm(false)}
                  className="flex-1 h-10 rounded-md bg-bg-sunken text-body font-medium text-ink-muted hover:bg-bg-overlay transition-colors duration-snap"
                >
                  Cancel
                </button>
                <button
                  type="button" onClick={handleDeactivate}
                  className="flex-1 h-10 rounded-md bg-danger text-body font-semibold text-ink-inverse active:opacity-80 transition-colors duration-snap"
                >
                  Confirm
                </button>
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
};
