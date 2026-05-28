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

  const showTabBar = overlay === null;

  const closeOverlay = (): void => {
    setOverlay(null);
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
        onOpenLogActivity={() => setOverlay('log-activity')}
      />
    );
  } else if (activeTab === 'log') {
    mainContent = (
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={() => setOverlay('log-activity')}
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
