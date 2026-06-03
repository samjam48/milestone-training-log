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
} from './components/screens';
import type { Goal } from './types';
import { useMilestoneEngine, type MilestoneEngineResult } from './hooks/useMilestoneEngine';

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
  return <></>;
}

export function App(): React.ReactElement {
  const engine = useMilestoneEngine();
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');
  const [overlay, setOverlay] = React.useState<OverlayKey | null>(null);
  const [logActivityPrefillId, setLogActivityPrefillId] = React.useState<
    string | undefined
  >(undefined);
  const [screenStack, setScreenStack] = React.useState<StackEntry[]>([]);

  const pushScreen = (screen: string, params: Record<string, unknown> = {}): void =>
    setScreenStack((s) => [...s, { screen, params }]);
  const popScreen = (): void => setScreenStack((s) => s.slice(0, -1));

  const showTabBar = overlay === null && screenStack.length === 0;

  const closeOverlay = (): void => {
    setOverlay(null);
    setLogActivityPrefillId(undefined);
  };

  const openLogActivity = (activityId?: string): void => {
    setLogActivityPrefillId(activityId);
    setOverlay('log-activity');
  };

  let mainContent: React.ReactElement;
  if (overlay === 'check-in') {
    mainContent = (
      <MorningCheckInScreen
        engine={engine}
        onBack={closeOverlay}
        onComplete={closeOverlay}
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
        onBack={closeOverlay}
        onComplete={closeOverlay}
      />
    );
  } else if (overlay === 'log-incident') {
    mainContent = (
      <LogIncidentScreen
        engine={engine}
        onBack={closeOverlay}
        onComplete={closeOverlay}
      />
    );
  } else if (activeTab === 'dashboard') {
    mainContent = (
      <DashboardScreen
        engine={engine}
        onOpenCheckIn={() => setOverlay('check-in')}
        onOpenLogActivity={openLogActivity}
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
      <SettingsScreen engine={engine} />
    );
  } else {
    mainContent = <ComingSoonPlaceholder />;
  }

  const topEntry = screenStack.length > 0 ? screenStack[screenStack.length - 1] : null;

  return (
    <AppShell withTabBar={showTabBar}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{mainContent}</div>
      {showTabBar && (
        <BottomTabBar active={activeTab} onChange={setActiveTab} />
      )}
      {topEntry != null && (
        <div
          data-testid="stack-screen-overlay"
          className="absolute inset-0 z-40 flex flex-col bg-bg"
        >
          {resolveStackScreen(topEntry, engine, popScreen)}
        </div>
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
