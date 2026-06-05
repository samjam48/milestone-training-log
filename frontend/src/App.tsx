import * as React from 'react';
import { AppShell } from './components/ui/AppShell';
import { BottomTabBar, type TabKey } from './components/ui/BottomTabBar';
import {
  DashboardScreen,
  LogHistoryScreen,
  MorningCheckInScreen,
  LogActivityScreen,
  LogIncidentScreen,
  GoalsScreen,
  GoalEditorScreen,
  SettingsScreen,
  LoginScreen,
  EditBlockRulesScreen,
  BlockReviewScreen,
  NewTrainingBlockScreen,
  ActivityManagerScreen,
  InlineLogSheet,
} from './components/screens';
import type { Activity, Goal } from './types';
import { useMilestoneEngine, type MilestoneEngineResult } from './hooks/useMilestoneEngine';
import { useMilestoneNavigationHistory } from './hooks/useMilestoneNavigationHistory';

type OverlayKey = 'check-in' | 'log-activity' | 'log-incident';
type StackEntry = { screen: string; params: Record<string, unknown> };

function resolveLogActivityPrefill(
  prefillId: string | undefined,
  activities: { id: string }[],
): string | undefined {
  if (prefillId == null || prefillId === '') return undefined;
  return activities.some((a) => a.id === prefillId) ? prefillId : undefined;
}

function ComingSoonPlaceholder(): React.ReactElement {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-body-lg text-ink-muted">Coming soon</p>
    </div>
  );
}

function AppDashboardSkeleton(): React.ReactElement {
  return (
    <div
      data-testid="app-dashboard-skeleton"
      aria-busy="true"
      className="flex flex-col gap-5 px-4 pt-5 pb-4"
    >
      <div className="flex flex-col gap-2">
        <div className="skeleton h-8 w-3/4 max-w-xs rounded-md bg-bg-sunken animate-pulse" />
        <div className="skeleton h-4 w-1/2 max-w-[12rem] rounded-md bg-bg-sunken animate-pulse" />
      </div>
      <div className="skeleton h-24 w-full rounded-lg bg-bg-sunken animate-pulse" />
      <div className="skeleton h-32 w-full rounded-lg bg-bg-sunken animate-pulse" />
      <div className="skeleton h-40 w-full rounded-lg bg-bg-sunken animate-pulse" />
    </div>
  );
}

function AppFatalError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div
      data-testid="app-fatal-error"
      role="alert"
      className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 px-4"
    >
      <p className="text-body-lg text-ink-muted text-center">Could not reach server</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-md bg-bg-sunken text-body font-medium text-ink"
      >
        Retry
      </button>
    </div>
  );
}

function resolveStackScreen(
  entry: StackEntry,
  engine: MilestoneEngineResult,
  onPop: () => void,
): React.ReactElement {
  if (entry.screen === 'goal-editor') {
    const goal = entry.params.goal as Omit<Goal, 'userId'> | undefined | null;
    return (
      <GoalEditorScreen
        goal={goal ?? null}
        engine={engine}
        onBack={onPop}
        onComplete={onPop}
      />
    );
  }
  if (entry.screen === 'edit-block-rules') {
    return <EditBlockRulesScreen engine={engine} onBack={onPop} />;
  }
  if (entry.screen === 'block-review') {
    const blockId = entry.params.blockId as string | undefined;
    return (
      <BlockReviewScreen engine={engine} blockId={blockId} onBack={onPop} />
    );
  }
  if (entry.screen === 'new-training-block') {
    return (
      <NewTrainingBlockScreen
        engine={engine}
        onBack={onPop}
        onComplete={onPop}
      />
    );
  }
  if (entry.screen === 'activity-manager') {
    const activity = entry.params.activity as Activity | undefined;
    if (activity == null) return <></>;
    return (
      <ActivityManagerScreen
        activity={activity}
        engine={engine}
        onBack={onPop}
        onComplete={onPop}
      />
    );
  }
  return <></>;
}

export function App(): React.ReactElement {
  const engine = useMilestoneEngine();
  const [sessionEnded, setSessionEnded] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');
  const [overlay, setOverlay] = React.useState<OverlayKey | null>(null);
  const [logActivityPrefillId, setLogActivityPrefillId] = React.useState<
    string | undefined
  >(undefined);
  const [inlineLogActivity, setInlineLogActivity] = React.useState<Activity | null>(null);
  const [screenStack, setScreenStack] = React.useState<StackEntry[]>([]);

  const pushScreen = (screen: string, params: Record<string, unknown> = {}): void =>
    setScreenStack((s) => [...s, { screen, params }]);
  const popScreen = React.useCallback(
    (): void => setScreenStack((s) => s.slice(0, -1)),
    [],
  );

  const showLogin = engine.isUnauthorized || sessionEnded;

  const historyEnabled =
    !showLogin && !engine.isInitialLoading && !engine.isFatalError;

  const closeOverlay = React.useCallback((): void => {
    setOverlay(null);
    setLogActivityPrefillId(undefined);
  }, []);

  const { navigateBack } = useMilestoneNavigationHistory({
    enabled: historyEnabled,
    overlayOpen: overlay !== null,
    stackDepth: screenStack.length,
    onCloseOverlay: closeOverlay,
    onPopScreen: popScreen,
  });

  const handleAuthenticated = (): void => {
    setSessionEnded(false);
    engine.refetchAll();
  };

  const handleUnauthenticated = (): void => {
    setSessionEnded(true);
  };

  if (showLogin) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  // Wait for first dashboard response before showing the tab shell. Otherwise
  // isUnauthorized is false while pending and users see an empty shell + nav.
  if (engine.isInitialLoading) {
    return (
      <AppShell withTabBar={false}>
        <AppDashboardSkeleton />
      </AppShell>
    );
  }

  const shellBlocked = engine.isFatalError;
  const showTabBar =
    !engine.isFatalError && overlay === null && screenStack.length === 0;

  const openLogActivity = (activityId?: string): void => {
    setLogActivityPrefillId(activityId);
    setOverlay('log-activity');
  };

  const closeInlineLog = (): void => setInlineLogActivity(null);

  let mainContent: React.ReactElement;
  if (engine.isFatalError) {
    mainContent = <AppFatalError onRetry={() => { engine.refetchAll(); }} />;
  } else if (overlay === 'check-in') {
    mainContent = (
      <MorningCheckInScreen
        engine={engine}
        onBack={navigateBack}
        onComplete={navigateBack}
      />
    );
  } else if (overlay === 'log-activity') {
    mainContent = (
      <LogActivityScreen
        engine={engine}
        initialActivityId={resolveLogActivityPrefill(
          logActivityPrefillId,
          engine.activities,
        )}
        onBack={navigateBack}
        onComplete={navigateBack}
      />
    );
  } else if (overlay === 'log-incident') {
    mainContent = (
      <LogIncidentScreen
        engine={engine}
        onBack={navigateBack}
        onComplete={navigateBack}
      />
    );
  } else if (activeTab === 'dashboard') {
    mainContent = (
      <DashboardScreen
        engine={engine}
        onOpenCheckIn={() => setOverlay('check-in')}
        onOpenLogActivity={openLogActivity}
        onQuickLog={setInlineLogActivity}
      />
    );
  } else if (activeTab === 'log') {
    mainContent = (
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={() => openLogActivity()}
        onOpenLogIncident={() => setOverlay('log-incident')}
      />
    );
  } else if (activeTab === 'goals') {
    mainContent = (
      <GoalsScreen
        engine={engine}
        onNewGoal={() => pushScreen('goal-editor')}
        onEditGoal={(goal) => pushScreen('goal-editor', { goal })}
      />
    );
  } else if (activeTab === 'settings') {
    mainContent = (
      <SettingsScreen
        engine={engine}
        onEditRules={() => pushScreen('edit-block-rules')}
        onReview={() => pushScreen('block-review')}
        onNewBlock={() => pushScreen('new-training-block')}
        onViewBlock={(blockId) => pushScreen('block-review', { blockId })}
        onEditActivity={(activity) => pushScreen('activity-manager', { activity })}
        onUnauthenticated={handleUnauthenticated}
      />
    );
  } else {
    mainContent = <ComingSoonPlaceholder />;
  }

  const topEntry =
    !shellBlocked && screenStack.length > 0
      ? screenStack[screenStack.length - 1]
      : null;
  return (
    <AppShell withTabBar={showTabBar}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{mainContent}</div>
      {showTabBar && (
        <BottomTabBar active={activeTab} onChange={setActiveTab} />
      )}
      {topEntry != null && (
        <div
          data-testid="stack-screen-overlay"
          className="absolute inset-0 z-40 flex flex-col bg-bg pt-safe-top"
        >
          {resolveStackScreen(topEntry, engine, navigateBack)}
        </div>
      )}
      {!shellBlocked && (
        <InlineLogSheet
          open={inlineLogActivity != null}
          activity={inlineLogActivity}
          engine={engine}
          onClose={closeInlineLog}
        />
      )}
      {/* Test affordance — allows exercising pushScreen with an unknown key */}
      <button
        type="button"
        data-testid="test-push-unknown-screen"
        onClick={() => pushScreen('unknown-key')}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </AppShell>
  );
}
