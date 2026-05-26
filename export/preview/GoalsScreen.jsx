// preview/GoalsScreen.jsx — Goals & Planning screen with GoalCard composite.
// Deps: primitives.jsx (Card, CardHeader, CardTitle, CardMeta, ProgressBar, cn)

const { useState: useGS, useMemo: useGSMemo } = React;

// ── GoalCard ──────────────────────────────────────────────────────────────────

function _goalState(value, target) {
  if (value == null || !target) return 'neutral';
  const r = value / target;
  if (r >= 1)   return 'safe';
  if (r >= 0.4) return 'caution';
  return 'neutral';
}

function GoalCard({ goal, activityClassName, onEdit, onArchive }) {
  const hasProgress = goal.value != null && goal.target != null && goal.target > 0;
  const state       = _goalState(goal.value, goal.target);

  const dueFmt = goal.targetDate
    ? new Date(goal.targetDate + 'T00:00:00Z').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      })
    : null;

  let valueText = null;
  if (hasProgress) {
    valueText = goal.unit === 'sessions' || goal.unit === 'weeks'
      ? `${goal.value} / ${goal.target} ${goal.unit}`
      : `${goal.value} / ${goal.target} ${goal.unit}`;
  }

  return (
    <Card pad="md">
      {/* Title + class chip */}
      <div className="mb-3">
        <p className="text-body-lg font-semibold text-ink leading-snug">{goal.title}</p>
        {activityClassName && (
          <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium bg-bg-sunken text-ink-muted mt-1.5">
            {activityClassName}
          </span>
        )}
      </div>

      {/* Progress bar or qualitative placeholder */}
      {hasProgress ? (
        <div className="mb-3">
          <ProgressBar value={goal.value} target={goal.target} state={state} valueText={valueText} />
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-pill bg-bg-sunken" aria-hidden="true" />
          <span className="text-caption text-ink-faint shrink-0">Qualitative</span>
        </div>
      )}

      {/* Footer: due date + actions */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-ink-muted">{dueFmt ? `Due ${dueFmt}` : ''}</span>
        <div className="flex gap-1.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="h-8 px-3 rounded-md text-caption font-medium text-ink-muted bg-bg-sunken hover:bg-bg-overlay transition-colors duration-snap"
            >
              Edit
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={() => onArchive(goal.id)}
              className="h-8 px-3 rounded-md text-caption font-medium text-ink-faint hover:text-ink-muted transition-colors duration-snap"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── GoalsScreen ───────────────────────────────────────────────────────────────

function GoalsScreen({ engine }) {
  const { goals, activityClasses, archiveGoal } = engine;

  const classMap = useGSMemo(
    () => new Map(activityClasses.map(c => [c.id, c])),
    [activityClasses],
  );

  const monthly   = useGSMemo(() => goals.filter(g => g.status === 'active' && g.timeframe === 'monthly'),   [goals]);
  const quarterly = useGSMemo(() => goals.filter(g => g.status === 'active' && g.timeframe === 'quarterly'), [goals]);
  const achieved  = useGSMemo(() => goals.filter(g => g.status === 'achieved'), [goals]);
  const hasActive = monthly.length > 0 || quarterly.length > 0;

  const [showAchieved, setShowAchieved] = useGS(false);

  function className(goal) {
    return goal.activityClassId ? classMap.get(goal.activityClassId)?.name ?? null : null;
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <h1 className="text-title font-bold text-ink">Goals</h1>
        <p className="text-caption text-ink-muted mt-0.5">
          {monthly.length + quarterly.length} active
          {achieved.length > 0 ? ` · ${achieved.length} achieved` : ''}
        </p>
      </div>

      {/* Scrollable body — pb-24 clears the sticky CTA */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 min-h-0">
        {!hasActive ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center mt-16 px-4">
            <p className="text-title font-semibold text-ink">No goals yet</p>
            <p className="text-body text-ink-muted">
              Set a monthly or quarterly target to track your progress here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Monthly */}
            {monthly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">This month</p>
                <div className="flex flex-col gap-3">
                  {monthly.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={className(g)}
                      onEdit={() => {}}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Quarterly */}
            {quarterly.length > 0 && (
              <section>
                <p className="text-label uppercase font-medium text-ink-muted mb-3">This quarter</p>
                <div className="flex flex-col gap-3">
                  {quarterly.map(g => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      activityClassName={className(g)}
                      onEdit={() => {}}
                      onArchive={archiveGoal}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Achieved — collapsed by default */}
            {achieved.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowAchieved(s => !s)}
                  className="flex w-full items-center justify-between gap-2 mb-3 text-left"
                >
                  <span className="text-label uppercase font-medium text-ink-muted">
                    Achieved ({achieved.length})
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                    className={cn(
                      'text-ink-faint transition-transform duration-snap',
                      showAchieved ? 'rotate-180' : '',
                    )}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showAchieved && (
                  <div className="flex flex-col gap-3">
                    {achieved.map(g => (
                      <GoalCard key={g.id} goal={g} activityClassName={className(g)} />
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>

      {/* Sticky + New Goal CTA */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #0A0C0F 55%, transparent)' }}
      >
        <button
          type="button"
          className="pointer-events-auto w-full h-12 rounded-md bg-ink text-ink-inverse text-body-lg font-semibold transition-colors duration-snap active:opacity-80"
        >
          + New Goal
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { GoalCard, GoalsScreen });
