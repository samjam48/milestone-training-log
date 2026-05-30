// =============================================================================
// NewActivitySheet — bottom sheet for creating a new ad-hoc activity
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { ActivityClass, ActivityType, VolumeUnit } from '../../types';
import type { NewActivityDraft } from '../../hooks/useMilestoneEngine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: 'performance' as ActivityType, label: 'Performance', tone: 'neutral' as const },
  { value: 'recovery' as ActivityType, label: 'Recovery', tone: 'neutral' as const },
];

const UNIT_OPTIONS: { value: VolumeUnit; label: string }[] = [
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'miles' },
  { value: 'minutes', label: 'minutes' },
  { value: 'reps', label: 'reps' },
  { value: 'sets', label: 'sets' },
  { value: 'sessions', label: 'sessions' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewActivitySheetProps {
  open: boolean;
  onClose: () => void;
  activityClasses: ActivityClass[];
  onCreate: (draft: NewActivityDraft & { id: string }) => void;
  onCreated?: (draft: NewActivityDraft & { id: string }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewActivitySheet({
  open,
  onClose,
  activityClasses,
  onCreate,
  onCreated,
}: NewActivitySheetProps) {
  const [name, setName] = React.useState('');
  const [classId, setClassId] = React.useState<string>(activityClasses[0]?.id ?? '');
  const [type, setType] = React.useState<ActivityType>('performance');
  const [unit, setUnit] = React.useState<VolumeUnit>('km');

  // Reset state every time the sheet opens (open flips false → true)
  React.useEffect(() => {
    if (open) {
      setName('');
      setClassId(activityClasses[0]?.id ?? '');
      setType('performance');
      setUnit('km');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canCreate = name.trim().length > 0 && classId !== '';

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate) return;

    const id = crypto.randomUUID();
    const draft: NewActivityDraft & { id: string } = {
      id,
      name: name.trim(),
      activityClassId: classId,
      type,
      defaultVolumeUnit: unit,
    };
    onCreate(draft);
    onCreated?.(draft);
    onClose();
  }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-2xl bg-bg-raised border-t border-border"
        role="dialog"
        aria-modal="true"
        aria-label="Create new activity"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="px-4 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-title font-bold text-ink">New Activity</h2>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-bg-overlay transition-colors duration-snap"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">

            {/* ── Name ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Activity name</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Evening jog"
                autoFocus
                aria-label="Activity name"
                className={cn(
                  'w-full rounded-md bg-bg-sunken border border-border px-3 py-2.5',
                  'text-body text-ink placeholder:text-ink-faint',
                  'focus:outline-none focus:border-border-strong',
                )}
              />
            </div>

            {/* ── Class picker ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Activity class</p>
              {activityClasses.length === 0 ? (
                <p className="text-body text-ink-faint py-2">No activity classes</p>
              ) : (
                <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
                  {activityClasses.map((cls) => {
                    const isSelected = classId === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setClassId(cls.id)}
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                          isSelected ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-body font-medium',
                              isSelected ? 'text-ink' : 'text-ink-muted',
                            )}
                          >
                            {cls.name}
                          </p>
                          <p className="text-caption text-ink-faint capitalize">{cls.type}</p>
                        </div>
                        {isSelected && (
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
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Type ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Type</p>
              <SegmentedControl
                value={type}
                onChange={setType}
                options={TYPE_OPTIONS}
                ariaLabel="Activity type"
              />
            </div>

            {/* ── Volume unit ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Volume unit</p>
              <div className="grid grid-cols-3 gap-1.5">
                {UNIT_OPTIONS.map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    aria-pressed={unit === u.value}
                    onClick={() => setUnit(u.value)}
                    className={cn(
                      'h-9 rounded-md text-body font-medium transition-colors duration-snap border',
                      unit === u.value
                        ? 'bg-ink text-ink-inverse border-transparent'
                        : 'bg-bg-sunken text-ink-muted border-border hover:bg-bg-overlay',
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-md bg-bg-sunken text-body font-medium text-ink-muted transition-colors duration-snap active:bg-bg-overlay"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canCreate}
                className={cn(
                  'flex-1 h-11 rounded-md text-body-lg font-semibold transition-colors duration-snap',
                  canCreate
                    ? 'bg-ink text-ink-inverse active:opacity-80'
                    : 'bg-ink/20 text-ink-faint cursor-not-allowed',
                )}
              >
                Create
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
