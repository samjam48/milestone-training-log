import * as React from 'react';
import { AppShell } from './components/ui/AppShell';
import { BottomTabBar, type TabKey } from './components/ui/BottomTabBar';
import {
  DashboardScreen,
  LogHistoryScreen,
  MorningCheckInScreen,
  LogActivityScreen,
  LogIncidentScreen,
} from './components/screens';
import { useMilestoneEngine } from './hooks/useMilestoneEngine';

type OverlayKey = 'check-in' | 'log-activity' | 'log-incident';

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

export function App(): React.ReactElement {
  const engine = useMilestoneEngine();
  const [activeTab, setActiveTab] = React.useState<TabKey>('dashboard');
  const [overlay, setOverlay] = React.useState<OverlayKey | null>(null);
  const [logActivityPrefillId, setLogActivityPrefillId] = React.useState<
    string | undefined
  >(undefined);

  const showTabBar = overlay === null;

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
    mainContent = <ComingSoonPlaceholder />;
  } else {
    mainContent = <ComingSoonPlaceholder />;
  }

  return (
    <AppShell withTabBar={showTabBar}>
      <div className="flex min-h-0 flex-1 flex-col">{mainContent}</div>
      {showTabBar && (
        <BottomTabBar active={activeTab} onChange={setActiveTab} />
      )}
    </AppShell>
  );
}
