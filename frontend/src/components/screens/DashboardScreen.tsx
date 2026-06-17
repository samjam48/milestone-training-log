// =============================================================================
// DashboardScreen — Tier 3
// =============================================================================

import * as React from 'react';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl';
import { DashboardTodayTab } from './DashboardTodayTab';
import { DashboardMetricsTab } from './DashboardMetricsTab';
import { DashboardSafetyTab } from './DashboardSafetyTab';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity } from '../../types';

const DASHBOARD_TAB_STORAGE_KEY = 'milestone.dashboard.activeTab';

type DashboardTab = 'today' | 'metrics' | 'safety';

interface Props {
  engine: MilestoneEngineResult;
  onOpenCheckIn: () => void;
  onOpenLogActivity: (activityId?: string) => void;
  onQuickLog?: (activity: Activity) => void;
  onViewGoals?: () => void;
  onViewSettings?: () => void;
}

const DASHBOARD_TAB_OPTIONS: SegmentedOption<DashboardTab>[] = [
  { value: 'today', label: 'Today' },
  { value: 'metrics', label: 'Metrics' },
  { value: 'safety', label: 'Safety' },
];

function isDashboardTab(value: string | null): value is DashboardTab {
  return value === 'today' || value === 'metrics' || value === 'safety';
}

function readStoredDashboardTab(): DashboardTab {
  if (typeof window === 'undefined') {
    return 'today';
  }

  try {
    const storage = window.localStorage;
    const storedValue =
      typeof storage.getItem === 'function'
        ? storage.getItem(DASHBOARD_TAB_STORAGE_KEY)
        : (storage as Storage & Record<string, string | undefined>)[DASHBOARD_TAB_STORAGE_KEY] ?? null;
    return isDashboardTab(storedValue) ? storedValue : 'today';
  } catch {
    return 'today';
  }
}

function storeDashboardTab(tab: DashboardTab): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const storage = window.localStorage;
    if (typeof storage.setItem === 'function') {
      storage.setItem(DASHBOARD_TAB_STORAGE_KEY, tab);
    } else {
      (storage as Storage & Record<string, string>)[DASHBOARD_TAB_STORAGE_KEY] = tab;
    }
  } catch {
    // View preference persistence should never block rendering.
  }
}

export const DashboardScreen: React.FC<Props> = ({
  engine,
  onOpenCheckIn,
  onOpenLogActivity,
  onQuickLog,
  onViewGoals,
  onViewSettings,
}) => {
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(() => readStoredDashboardTab());

  const handleTabChange = React.useCallback((nextTab: DashboardTab) => {
    setActiveTab(nextTab);
    storeDashboardTab(nextTab);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-4">
      <SegmentedControl
        value={activeTab}
        onChange={handleTabChange}
        options={DASHBOARD_TAB_OPTIONS}
        ariaLabel="Dashboard tabs"
      />

      {activeTab === 'today' && (
        <DashboardTodayTab
          engine={engine}
          onOpenCheckIn={onOpenCheckIn}
          onOpenLogActivity={onOpenLogActivity}
          onQuickLog={onQuickLog}
        />
      )}

      {activeTab === 'metrics' && (
        <DashboardMetricsTab
          engine={engine}
          onViewGoals={onViewGoals}
        />
      )}

      {activeTab === 'safety' && (
        <DashboardSafetyTab
          engine={engine}
          onViewSettings={onViewSettings}
        />
      )}
    </div>
  );
};
