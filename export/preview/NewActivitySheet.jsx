// preview/NewActivitySheet.jsx — Bottom sheet: ad-hoc activity creator
// Triggered from LogActivityScreen; exports to window.

const { useState: useNAS, useEffect: useNASFx } = React;

const NAS_TYPE_OPTIONS = [
  { value: 'performance', label: 'Performance', tone: 'neutral' },
  { value: 'recovery',    label: 'Recovery',    tone: 'neutral' },
];

const NAS_UNIT_OPTIONS = ['km', 'miles', 'minutes', 'reps', 'sets', 'sessions'];

function NewActivitySheet({ open, onClose, activityClasses, submitNewActivity, onCreated }) {
  const [name,    setName]    = useNAS('');
  const [classId, setClassId] = useNAS(() => activityClasses[0]?.id || '');
  const [type,    setType]    = useNAS('performance');
  const [unit,    setUnit]    = useNAS('km');

  // Reset whenever the sheet opens
  useNASFx(() => {
    if (open) {
      setName('');
      setClassId(activityClasses[0]?.id || '');
      setType('performance');
      setUnit('km');
    }
  }, [open]);

  if (!open) return null;

  const canCreate = name.trim().length > 0 && !!classId;

  function handleCreate(e) {
    e.preventDefault();
    if (!canCreate) return;
    const newActivity = submitNewActivity({
      name: name.trim(),
      activityClassId: classId,
      type,
      defaultVolumeUnit: unit,
    });
    onCreated && onCreated(newActivity);
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
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Evening jog"
                autoFocus
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
              <div className="flex flex-col divide-y divide-border-subtle rounded-md border border-border overflow-hidden">
                {activityClasses.map(cls => {
                  const sel = classId === cls.id;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setClassId(cls.id)}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors duration-snap',
                        sel ? 'bg-ink/10' : 'bg-bg-sunken hover:bg-bg-overlay',
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn('text-body font-medium', sel ? 'text-ink' : 'text-ink-muted')}>
                          {cls.name}
                        </p>
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

            {/* ── Type ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Type</p>
              <SegmentedControl
                value={type}
                onChange={setType}
                options={NAS_TYPE_OPTIONS}
                ariaLabel="Activity type"
              />
            </div>

            {/* ── Volume unit ── */}
            <div>
              <p className="text-body font-medium text-ink mb-2">Volume unit</p>
              <div className="grid grid-cols-3 gap-1.5">
                {NAS_UNIT_OPTIONS.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
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

Object.assign(window, { NewActivitySheet });
