import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ACTIVITY_VOLUME_UNIT_OPTIONS } from './activityVolumeUnits';
import type { Activity, ActivityType, ID, VolumeUnit } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';

const TYPE_OPTIONS = [
  { value: 'performance' as ActivityType, label: 'Performance', tone: 'neutral' as const },
  { value: 'recovery' as ActivityType, label: 'Recovery', tone: 'neutral' as const },
];

export interface ActivityManagerScreenProps {
  activity: Activity;
  engine: MilestoneEngineResult;
  onBack: () => void;
  onComplete: () => void;
}

export function ActivityManagerScreen({
  activity,
  engine,
  onBack,
  onComplete,
}: ActivityManagerScreenProps): React.ReactElement {
  const [name, setName] = React.useState(activity.name);
  const [classId, setClassId] = React.useState<ID>(activity.activityClassId);
  const [type, setType] = React.useState<ActivityType>(activity.type);
  const [unit, setUnit] = React.useState<VolumeUnit>(activity.defaultVolumeUnit ?? 'km');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = React.useState(false);

  const canSave = name.trim().length > 0 && classId !== '';

  function handleSave(): void {
    if (!canSave) return;

    engine.updateActivity(activity.id, {
      name: name.trim(),
      activityClassId: classId,
      type,
      defaultVolumeUnit: unit,
    });
    onComplete();
  }

  function handleDeactivate(): void {
    engine.deactivateActivity(activity.id);
    onComplete();
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors duration-snap hover:bg-bg-overlay hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 12L6 8l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="flex-1 text-title font-bold text-ink">Edit Activity</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            'h-9 rounded-md px-4 text-body font-semibold transition-colors duration-snap',
            canSave ? 'bg-ink text-ink-inverse' : 'cursor-not-allowed bg-ink/20 text-ink-faint',
          )}
        >
          Save
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 pb-12">
        <div>
          <p className="mb-2 text-body font-medium text-ink">Activity name</p>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Activity name"
            className={cn(
              'w-full rounded-md border border-border bg-bg-sunken px-3 py-2.5',
              'text-body text-ink focus:border-border-strong focus:outline-none',
            )}
          />
        </div>

        <div>
          <p className="mb-2 text-body font-medium text-ink">Activity class</p>
          {engine.activityClasses.length === 0 ? (
            <p className="py-2 text-body text-ink-faint">No activity classes</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border">
              {engine.activityClasses.map((activityClass) => {
                const isSelected = classId === activityClass.id;
                return (
                  <button
                    key={activityClass.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setClassId(activityClass.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                      isSelected ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-body font-medium',
                          isSelected ? 'text-ink' : 'text-ink-muted',
                        )}
                      >
                        {activityClass.name}
                      </span>
                      <span className="block text-caption capitalize text-ink-faint">
                        {activityClass.type}
                      </span>
                    </span>
                    {isSelected ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="shrink-0"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8l3.5 3.5L13 4"
                          stroke="#E8ECF1"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-body font-medium text-ink">Type</p>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={TYPE_OPTIONS}
            ariaLabel="Activity type"
          />
        </div>

        <div>
          <p className="mb-2 text-body font-medium text-ink">Volume unit</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ACTIVITY_VOLUME_UNIT_OPTIONS.map((option) => {
              const isSelected = unit === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setUnit(option.value)}
                  className={cn(
                    'h-9 rounded-md border text-body font-medium transition-colors duration-snap',
                    isSelected
                      ? 'border-transparent bg-ink text-ink-inverse'
                      : 'border-border bg-bg-sunken text-ink-muted hover:bg-bg-overlay',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          {!showDeactivateConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeactivateConfirm(true)}
              className="h-11 w-full rounded-md border border-danger/40 text-body font-medium text-danger-fg transition-colors duration-snap hover:bg-danger/10"
            >
              Deactivate activity
            </button>
          ) : (
            <Card intent="danger" pad="md">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeactivateConfirm(false)}
                  className="h-10 flex-1 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap hover:bg-bg-overlay"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  className="h-10 flex-1 rounded-md bg-danger text-body font-semibold text-ink-inverse transition-colors duration-snap active:opacity-80"
                >
                  Confirm
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
