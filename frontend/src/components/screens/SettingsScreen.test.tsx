/**
 * F2.3 — SettingsScreen component tests (failing first, TDD).
 * F10.6 — Review milestone badge on BlockSummaryCard and previous-block rows
 *         (plans/tickets-phase-10-polish-2026-06-04.md).
 *
 * Tests are written against the public contract defined in the ticket:
 *   Props: { engine: MilestoneEngineResult }
 *
 * Spec: export/preview/SettingsScreen.jsx, MOCKUPS.md §Screen 5 / 5b
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type {
  ActivityClass,
  Activity,
  ActivityLog,
  Rule,
  WeeklyTarget,
  TrainingBlock,
} from '../../types';
import type { NewActivityDraft } from '../../hooks/useMilestoneEngine';
import { SettingsScreen } from './SettingsScreen';

// Module-level mock for apiFetch used in F2.6 onClick wiring tests.
// vi.hoisted ensures the variable is available when the hoisted vi.mock factory runs.
const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/api/client', () => ({
  apiFetch: apiFetchMock,
  apiFetchOrNullOn404: vi.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_STRENGTH: ActivityClass = {
  id: 'cls-strength',
  userId: 'user-1',
  name: 'Strength',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'May Rehab Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const PREVIOUS_BLOCK_1: TrainingBlock = {
  id: 'blk-prev-1',
  userId: 'user-1',
  name: 'April Block',
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-04-01T00:00:00Z',
};

const PREVIOUS_BLOCK_2: TrainingBlock = {
  id: 'blk-prev-2',
  userId: 'user-1',
  name: 'March Block',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  status: 'completed',
  isReviewMilestoneHit: false,
  createdAt: '2026-03-01T00:00:00Z',
};

const RULE_REST: Rule = {
  id: 'rule-rest-1',
  trainingBlockId: 'blk-active',
  activityClassId: 'cls-running',
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const RULE_FREQ: Rule = {
  id: 'rule-freq-1',
  trainingBlockId: 'blk-active',
  activityClassId: 'cls-running',
  ruleType: 'frequency_limit',
  thresholdValue: 3,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const RULE_DISABLED: Rule = {
  id: 'rule-disabled-1',
  trainingBlockId: 'blk-active',
  activityClassId: 'cls-running',
  ruleType: 'weekly_load_cap',
  thresholdValue: 100,
  windowDays: 7,
  enabled: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const RULE_CROSS_CLASS: Rule = {
  id: 'rule-cross-1',
  trainingBlockId: 'blk-active',
  activityClassId: null,
  ruleType: 'weekly_activity_count',
  thresholdValue: 5,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const WEEKLY_TARGET_RUNNING: WeeklyTarget = {
  id: 'wt-running-1',
  trainingBlockId: 'blk-active',
  activityClassId: 'cls-running',
  targetValue: 20,
  targetUnit: 'km',
  createdAt: '2026-05-01T00:00:00Z',
};

const WEEKLY_TARGET_UNKNOWN_CLASS: WeeklyTarget = {
  id: 'wt-unknown-1',
  trainingBlockId: 'blk-active',
  activityClassId: 'cls-unknown-xyz',
  targetValue: 5,
  targetUnit: 'sessions',
  createdAt: '2026-05-01T00:00:00Z',
};

const ACTIVITY_RUNNING: Activity = {
  id: 'act-run-1',
  userId: 'user-1',
  activityClassId: 'cls-running',
  name: 'Morning Run',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_STRENGTH: Activity = {
  id: 'act-strength-1',
  userId: 'user-1',
  activityClassId: 'cls-strength',
  name: 'Squats',
  type: 'performance',
  defaultVolumeUnit: 'reps',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_INACTIVE: Activity = {
  id: 'act-inactive-1',
  userId: 'user-1',
  activityClassId: 'cls-running',
  name: 'Inactive Activity',
  type: 'performance',
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const LOG_RECENT: ActivityLog = {
  id: 'log-1',
  userId: 'user-1',
  activityId: 'act-run-1',
  loggedDate: '2026-05-28',
  durationMinutes: 30,
  volumeValue: 5,
  volumeUnit: 'km',
  createdAt: '2026-05-28T08:00:00Z',
};

const LOG_OLDER: ActivityLog = {
  id: 'log-2',
  userId: 'user-1',
  activityId: 'act-run-1',
  loggedDate: '2026-05-20',
  durationMinutes: 25,
  volumeValue: 4,
  volumeUnit: 'km',
  createdAt: '2026-05-20T08:00:00Z',
};

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper — build an engine stub from overrides
// ---------------------------------------------------------------------------

function makeEngine(
  overrides: Partial<typeof mockEngine> = {},
): typeof mockEngine {
  return { ...mockEngine, ...overrides };
}

interface SettingsScreenCallbackProps {
  engine: typeof mockEngine;
  onEditRules?: () => void;
  onReview?: () => void;
  onNewBlock?: () => void;
  onViewBlock?: (blockId: string) => void;
  onEditActivity?: (activity: Activity) => void;
}

const SettingsScreenWithCallbacks = SettingsScreen as unknown as (
  props: SettingsScreenCallbackProps,
) => JSX.Element;

function renderSettingsScreenWithCallbacks(props: SettingsScreenCallbackProps): void {
  renderWithProviders(<SettingsScreenWithCallbacks {...props} />);
}

function getSectionByHeading(name: RegExp): HTMLElement {
  const heading = screen.getByText(name);
  const section = heading.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

function getInactiveSection(): HTMLElement {
  const heading =
    screen.queryByText(/^inactive activities$/i)
    ?? screen.queryByText(/^archived activities$/i);
  expect(heading).not.toBeNull();
  const section = heading?.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

/** Previous-blocks list row (name cell → inner column → flex row). */
function withinPreviousBlockRow(blockName: string) {
  const nameEl = screen.getByText(blockName);
  const row = nameEl.parentElement?.parentElement;
  expect(row).not.toBeNull();
  return within(row as HTMLElement);
}

const REVIEW_MILESTONE_BADGE = /review milestone reached/i;

function renderStatefulSettingsScreen(options: {
  activities?: Activity[];
  activityClasses?: ActivityClass[];
  logs?: ActivityLog[];
} = {}) {
  let currentActivities = options.activities ?? [ACTIVITY_RUNNING, ACTIVITY_INACTIVE];
  const activityClasses = options.activityClasses ?? [CLASS_RUNNING];
  const logs = options.logs ?? [];

  let renderApi = renderWithProviders(<div />);

  const rerenderCurrent = () => {
    renderApi.rerender(
      <SettingsScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses,
          activities: currentActivities,
          logs,
          deactivateActivity,
          updateActivity,
        })}
      />,
    );
  };

  const deactivateActivity = vi.fn((activityId: string) => {
    currentActivities = currentActivities.map((activity) => (
      activity.id === activityId
        ? { ...activity, isActive: false }
        : activity
    ));
    rerenderCurrent();
  });

  const updateActivity = vi.fn((
    activityId: string,
    patch: Partial<NewActivityDraft> & { isActive?: boolean },
  ) => {
    currentActivities = currentActivities.map((activity) => (
      activity.id === activityId
        ? {
            ...activity,
            ...patch,
            isActive: patch.isActive ?? activity.isActive,
          }
        : activity
    ));
    rerenderCurrent();
  });

  renderApi.unmount();
  renderApi = renderWithProviders(
    <SettingsScreen
      engine={makeEngine({
        block: ACTIVE_BLOCK,
        activityClasses,
        activities: currentActivities,
        logs,
        deactivateActivity,
        updateActivity,
      })}
    />,
  );

  return {
    deactivateActivity,
    updateActivity,
    reload() {
      renderApi.unmount();
      renderApi = renderWithProviders(
        <SettingsScreen
          engine={makeEngine({
            block: ACTIVE_BLOCK,
            activityClasses,
            activities: currentActivities,
            logs,
            deactivateActivity,
            updateActivity,
          })}
        />,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Active Block Card — basic render
// ---------------------------------------------------------------------------

describe('SettingsScreen — Active Block card', () => {
  it('renders block name when an active block exists', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(ACTIVE_BLOCK.name)).toBeInTheDocument();
  });

  it('renders block start date when an active block exists', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // The date "2026-05-01" → formatted as "May 1" (UTC short)
    expect(screen.getByText(/may 1/i)).toBeInTheDocument();
  });

  it('renders "Active" status label when a block exists', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Weekly targets list
// ---------------------------------------------------------------------------

describe('SettingsScreen — Weekly Targets', () => {
  it('renders weekly targets from active block', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Class name resolved from activityClassId
    expect(screen.getByText(CLASS_RUNNING.name)).toBeInTheDocument();
    // Target value and unit
    expect(screen.getByText(/20/)).toBeInTheDocument();
    expect(screen.getByText(/km/i)).toBeInTheDocument();
  });

  it('resolves activityClassId → class name in weekly targets', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('falls back to raw activityClassId when class is not found in weekly targets', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_UNKNOWN_CLASS],
      activityClasses: [], // empty — class not found
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Falls back to raw id
    expect(screen.getByText('cls-unknown-xyz')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3–4. Recovery Rules list
// ---------------------------------------------------------------------------

describe('SettingsScreen — Recovery Rules', () => {
  it('renders enabled recovery rules with correct human labels', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // RULE_REST is rest_between_class with threshold 2 → "Min 2-day rest"
    expect(screen.getByText(/min 2.day rest/i)).toBeInTheDocument();
  });

  it('renders frequency_limit rule with correct label', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_FREQ],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // frequency_limit with threshold 3 → "Max 3× / week"
    expect(screen.getByText(/max 3.* week/i)).toBeInTheDocument();
  });

  it('excludes disabled rules from the recovery rules summary', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST, RULE_DISABLED],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // RULE_DISABLED is weekly_load_cap — its label should NOT appear
    expect(screen.queryByText(/load cap/i)).not.toBeInTheDocument();
    // RULE_REST should still appear
    expect(screen.getByText(/min 2.day rest/i)).toBeInTheDocument();
  });

  it('renders "All classes" label for rules with null activityClassId', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_CROSS_CLASS],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/all classes/i)).toBeInTheDocument();
  });

  it('falls back to raw ruleType when RuleType is not in RULE_LABEL map', () => {
    const unknownRule: Rule = {
      ...RULE_REST,
      id: 'rule-unknown',
      // Cast to bypass TypeScript — simulates an unknown rule type from API
      ruleType: 'some_future_rule_type' as Rule['ruleType'],
    };

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [unknownRule],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText('some_future_rule_type')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. No active block fallback
// ---------------------------------------------------------------------------

describe('SettingsScreen — No active block fallback', () => {
  const noBlock = {
    id: '',
    userId: 'user-1',
    name: '',
    startDate: '1970-01-01' as TrainingBlock['startDate'],
    endDate: '1970-01-01' as TrainingBlock['endDate'],
    status: 'active' as const,
    isReviewMilestoneHit: false,
    createdAt: '1970-01-01T00:00:00Z',
  };

  it('shows "No active training block" card when block id is empty', () => {
    const engine = makeEngine({
      block: noBlock,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/no active training block/i)).toBeInTheDocument();
  });

  it('hides or disables Edit Rules when there is no active block', () => {
    const engine = makeEngine({
      block: noBlock,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Edit Rules button should either be absent or disabled
    const editRulesButton = screen.queryByRole('button', { name: /edit rules/i });
    if (editRulesButton !== null) {
      expect(editRulesButton).toBeDisabled();
    } else {
      expect(editRulesButton).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Previous Blocks section
// ---------------------------------------------------------------------------

describe('SettingsScreen — Previous Blocks', () => {
  it('renders Previous Blocks section from engine.previousBlocks', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/previous blocks/i)).toBeInTheDocument();
    expect(screen.getByText(PREVIOUS_BLOCK_1.name)).toBeInTheDocument();
  });

  it('renders multiple previous blocks', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1, PREVIOUS_BLOCK_2],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(PREVIOUS_BLOCK_1.name)).toBeInTheDocument();
    expect(screen.getByText(PREVIOUS_BLOCK_2.name)).toBeInTheDocument();
  });

  it('renders a View action button for each previous block', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
  });

  it('does not render Previous Blocks section when previousBlocks is empty', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(/previous blocks/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7–9. Activities Manager
// ---------------------------------------------------------------------------

describe('SettingsScreen — Activities Manager', () => {
  it('renders the Activities section heading', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/activities/i)).toBeInTheDocument();
  });

  it('groups activities by class', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      activities: [ACTIVITY_RUNNING, ACTIVITY_STRENGTH],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Both class names should appear as group headers
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    // Both activity names should appear
    expect(screen.getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(screen.getByText(ACTIVITY_STRENGTH.name)).toBeInTheDocument();
  });

  it('shows last-log date for activities that have logs', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_RECENT, LOG_OLDER], // most recent is LOG_RECENT (May 28)
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Should show "May 28" (the max loggedDate)
    expect(screen.getByText(/may 28/i)).toBeInTheDocument();
  });

  it('shows the maximum loggedDate when activity has multiple logs', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_OLDER, LOG_RECENT], // order shouldn't matter
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Should show May 28 (most recent), not May 20 (older)
    expect(screen.getByText(/may 28/i)).toBeInTheDocument();
    expect(screen.queryByText(/may 20/i)).not.toBeInTheDocument();
  });

  it('shows "Never" label for activities with zero logs', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_STRENGTH],
      activities: [ACTIVITY_STRENGTH],
      logs: [], // no logs at all
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/never/i)).toBeInTheDocument();
  });

  it('keeps active and inactive activities in separate sections', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING, ACTIVITY_INACTIVE],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const activeSection = getSectionByHeading(/^activities$/i);
    expect(within(activeSection).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(activeSection).queryByText(ACTIVITY_INACTIVE.name)).not.toBeInTheDocument();

    const inactiveSection = getInactiveSection();
    expect(within(inactiveSection).getByText(ACTIVITY_INACTIVE.name)).toBeInTheDocument();
    expect(within(inactiveSection).queryByText(ACTIVITY_RUNNING.name)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9b. Stack action callbacks
// ---------------------------------------------------------------------------

describe('SettingsScreen — stack action callbacks', () => {
  it('calls onEditRules and does not open the inline form when Edit rules is clicked', async () => {
    const user = userEvent.setup();
    const onEditRules = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderSettingsScreenWithCallbacks({ engine, onEditRules });

    await user.click(screen.getByRole('button', { name: /edit rules/i }));

    expect(onEditRules).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: /edit rules/i })).not.toBeInTheDocument();
  });

  it('calls onReview when Review is clicked', async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onReview });

    await user.click(screen.getByRole('button', { name: /review/i }));

    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('calls onNewBlock and does not open the inline sheet when + New Training Block is clicked', async () => {
    const user = userEvent.setup();
    const onNewBlock = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
    });

    renderSettingsScreenWithCallbacks({ engine, onNewBlock });

    await user.click(screen.getByRole('button', { name: /\+ new training block/i }));

    expect(onNewBlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: /new training block/i })).not.toBeInTheDocument();
  });

  it('calls onViewBlock with the previous block id when View is clicked', async () => {
    const user = userEvent.setup();
    const onViewBlock = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onViewBlock });

    await user.click(screen.getByRole('button', { name: /view/i }));

    expect(onViewBlock).toHaveBeenCalledTimes(1);
    expect(onViewBlock).toHaveBeenCalledWith(PREVIOUS_BLOCK_1.id);
  });

  it('calls onEditActivity with the activity when Edit is clicked', async () => {
    const user = userEvent.setup();
    const onEditActivity = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onEditActivity });

    await user.click(screen.getByRole('button', { name: /edit morning run/i }));

    expect(onEditActivity).toHaveBeenCalledTimes(1);
    expect(onEditActivity).toHaveBeenCalledWith(ACTIVITY_RUNNING);
  });

  it('requires confirmation before calling engine.deactivateActivity from the activity list', async () => {
    const user = userEvent.setup();
    const deactivateActivity = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
      deactivateActivity,
    });

    renderSettingsScreenWithCallbacks({ engine });

    await user.click(screen.getByRole('button', { name: /deactivate morning run/i }));

    expect(deactivateActivity).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirm deactivate morning run/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel deactivating morning run/i })).toBeInTheDocument();
    expect(screen.queryByText(/deactivating hides this activity from the log picker/i)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — Q9.11B inactive activity recovery flow', () => {
  it('canceling deactivation leaves the activity active and visible in the active section', async () => {
    const user = userEvent.setup();
    const { deactivateActivity } = renderStatefulSettingsScreen({
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_RECENT],
    });

    await user.click(screen.getByRole('button', { name: /deactivate morning run/i }));
    await user.click(screen.getByRole('button', { name: /cancel deactivating morning run/i }));

    expect(deactivateActivity).not.toHaveBeenCalled();
    expect(within(getSectionByHeading(/^activities$/i)).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
  });

  it('confirmed deactivation moves the activity into the inactive section and preserves its log history metadata', async () => {
    const user = userEvent.setup();
    const { deactivateActivity } = renderStatefulSettingsScreen({
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_RECENT],
    });

    await user.click(screen.getByRole('button', { name: /deactivate morning run/i }));
    await user.click(screen.getByRole('button', { name: /confirm deactivate morning run/i }));

    expect(deactivateActivity).toHaveBeenCalledTimes(1);
    expect(deactivateActivity).toHaveBeenCalledWith(ACTIVITY_RUNNING.id);
    expect(within(getSectionByHeading(/^activities$/i)).queryByText(ACTIVITY_RUNNING.name)).not.toBeInTheDocument();
    expect(within(getInactiveSection()).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(getInactiveSection()).getByText(/may 28/i)).toBeInTheDocument();
  });

  it('keeps inactive activities visible after a reload', async () => {
    const user = userEvent.setup();
    const harness = renderStatefulSettingsScreen({
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_RECENT],
    });

    await user.click(screen.getByRole('button', { name: /deactivate morning run/i }));
    await user.click(screen.getByRole('button', { name: /confirm deactivate morning run/i }));

    harness.reload();

    expect(within(getInactiveSection()).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(getSectionByHeading(/^activities$/i)).queryByText(ACTIVITY_RUNNING.name)).not.toBeInTheDocument();
  });

  it('restores an inactive activity to the active list after refresh', async () => {
    const user = userEvent.setup();
    const { updateActivity } = renderStatefulSettingsScreen({
      activities: [ACTIVITY_INACTIVE],
      logs: [LOG_RECENT],
    });

    await user.click(screen.getByRole('button', { name: /restore inactive activity/i }));

    expect(updateActivity).toHaveBeenCalledTimes(1);
    expect(updateActivity).toHaveBeenCalledWith(ACTIVITY_INACTIVE.id, { isActive: true });
    expect(within(getSectionByHeading(/^activities$/i)).getByText(ACTIVITY_INACTIVE.name)).toBeInTheDocument();
    expect(within(getInactiveSection()).queryByText(ACTIVITY_INACTIVE.name)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F10.10 — Remove inline EditRulesForm / NewTrainingBlockSheet
// Rule and block create/edit coverage: EditBlockRulesScreen.test.tsx,
// NewTrainingBlockScreen.test.tsx. plans/tickets-phase-10-polish-2026-06-04.md
// ---------------------------------------------------------------------------

describe('SettingsScreen — F10.10 remove inline rule and block sheets', () => {
  it('renders an Edit Rules button when a block is active', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /edit rules/i })).toBeInTheDocument();
  });

  it('does not mount the inline Edit Rules dialog in the document', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <SettingsScreen
        engine={engine}
        onEditRules={vi.fn()}
        onNewBlock={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('dialog', { name: /edit rules for/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking Edit rules without onEditRules does not open an inline Edit Rules sheet', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /edit rules/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not mount the inline New Training Block dialog in the document', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(
      <SettingsScreen
        engine={engine}
        onEditRules={vi.fn()}
        onNewBlock={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('dialog', { name: /new training block/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking + New Training Block without onNewBlock does not open an inline sheet', async () => {
    const user = userEvent.setup();
    const createTrainingBlock = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      createTrainingBlock,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new training block/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createTrainingBlock).not.toHaveBeenCalled();
  });

  it('keeps the dev Reset mock data control when VITE_DEV_MODE is true', () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(
      <SettingsScreen
        engine={engine}
        onEditRules={vi.fn()}
        onNewBlock={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /reset mock data/i })).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// 20–22. Preferences section
// ---------------------------------------------------------------------------

describe('SettingsScreen — Preferences section', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders Notifications toggle', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/notifications/i)).toBeInTheDocument();
  });

  it('renders Metric units toggle', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/metric units/i)).toBeInTheDocument();
  });

  it('Notifications toggle is local-only (no engine API calls on toggle)', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      createRule,
      updateRule,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const notificationsSwitch = screen.getByRole('switch', { name: /notifications/i });
    await user.click(notificationsSwitch);

    // No engine mutations should be called
    expect(createRule).not.toHaveBeenCalled();
    expect(updateRule).not.toHaveBeenCalled();
  });

  it('Metric units toggle is local-only (no engine API calls on toggle)', async () => {
    const user = userEvent.setup();
    const createTrainingBlock = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      createTrainingBlock,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const metricSwitch = screen.getByRole('switch', { name: /metric units/i });
    await user.click(metricSwitch);

    expect(createTrainingBlock).not.toHaveBeenCalled();
  });

  it('toggles Notifications switch state on click (local state)', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const notificationsSwitch = screen.getByRole('switch', { name: /notifications/i });
    const initialChecked = notificationsSwitch.getAttribute('aria-checked');

    await user.click(notificationsSwitch);

    const newChecked = notificationsSwitch.getAttribute('aria-checked');
    expect(newChecked).not.toBe(initialChecked);
  });

  it('renders Reset mock data button', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /reset mock data/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 23. About section
// ---------------------------------------------------------------------------

describe('SettingsScreen — About section', () => {
  it('renders About section heading', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/about/i)).toBeInTheDocument();
  });

  it('renders version string in About section', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // Version label row
    expect(screen.getByText(/version/i)).toBeInTheDocument();
    // Version value (e.g. "0.1.0-preview")
    expect(screen.getByText(/0\.1\.0/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 27. Edit / Deactivate stub actions on Activity rows
// ---------------------------------------------------------------------------

describe('SettingsScreen — Activity row stub actions', () => {
  it('renders Edit button on activity rows', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /edit morning run/i })).toBeInTheDocument();
  });

  it('renders Deactivate button on activity rows', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F2.6 — Reset mock data button: dev-mode guard + wiring
// ---------------------------------------------------------------------------
// These tests MUST FAIL until the implementation is in place:
//   - SettingsScreen.tsx wraps the Reset button in:
//       import.meta.env.VITE_DEV_MODE === 'true'
//   - The button onClick calls apiFetch('/dev/reset', { method: 'POST' })
//     then invalidates all queries.
//
// Mocking strategy:
//   - vi.stubEnv('VITE_DEV_MODE', 'true'/'false') patches import.meta.env per-test.
//   - apiFetch is mocked via vi.mock on the client module.
// ---------------------------------------------------------------------------

describe('SettingsScreen — Reset mock data button: dev-mode guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the Reset mock data button when VITE_DEV_MODE is "true"', () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.getByRole('button', { name: /reset mock data/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the Reset mock data button when VITE_DEV_MODE is "false"', () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.queryByRole('button', { name: /reset mock data/i }),
    ).not.toBeInTheDocument();
  });

  it('does NOT render the Reset mock data button when VITE_DEV_MODE is unset', () => {
    // Do not stub — relies on default (undefined/empty) value in test env
    vi.stubEnv('VITE_DEV_MODE', '');
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.queryByRole('button', { name: /reset mock data/i }),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — Reset mock data button: onClick wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls POST /api/dev/reset via apiFetch when the button is clicked in dev mode', async () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    apiFetchMock.mockClear();

    const user = userEvent.setup();
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // First click shows confirmation UI — apiFetch not called yet
    const resetButton = screen.getByRole('button', { name: /reset mock data/i });
    await user.click(resetButton);
    expect(apiFetchMock).not.toHaveBeenCalled();

    // Confirm click triggers the actual POST
    const confirmButton = screen.getByRole('button', { name: /^reset$/i });
    await user.click(confirmButton);

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/dev/reset',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ---------------------------------------------------------------------------
// F10.6 — Review milestone badge (B10.1 isReviewMilestoneHit)
// ---------------------------------------------------------------------------

describe('SettingsScreen — F10.6 review milestone badge', () => {
  it('shows review milestone badge on active BlockSummaryCard when isReviewMilestoneHit is true', () => {
    const engine = makeEngine({
      block: { ...ACTIVE_BLOCK, isReviewMilestoneHit: true },
      previousBlocks: [],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(REVIEW_MILESTONE_BADGE)).toBeInTheDocument();
  });

  it('does not show review milestone badge on active block when isReviewMilestoneHit is false', () => {
    const engine = makeEngine({
      block: { ...ACTIVE_BLOCK, isReviewMilestoneHit: false },
      previousBlocks: [],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(REVIEW_MILESTONE_BADGE)).not.toBeInTheDocument();
  });

  it('shows review milestone indicator on previous block rows when pb.isReviewMilestoneHit is true', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1, PREVIOUS_BLOCK_2],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      withinPreviousBlockRow(PREVIOUS_BLOCK_1.name).getByText(REVIEW_MILESTONE_BADGE),
    ).toBeInTheDocument();
    expect(
      withinPreviousBlockRow(PREVIOUS_BLOCK_2.name).queryByText(REVIEW_MILESTONE_BADGE),
    ).not.toBeInTheDocument();
  });

  it('allows an accessible label on previous-block milestone indicator (icon-only row)', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      withinPreviousBlockRow(PREVIOUS_BLOCK_1.name).getByLabelText(REVIEW_MILESTONE_BADGE),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SettingsScreen — edge cases', () => {
  it('handles no activities without crashing', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [],
      logs: [],
    });

    expect(() => {
      renderWithProviders(<SettingsScreen engine={engine} />);
    }).not.toThrow();
  });

  it('handles no previous blocks gracefully (no Previous Blocks section)', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(/previous blocks/i)).not.toBeInTheDocument();
  });

  it('handles empty rules list gracefully', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    expect(() => {
      renderWithProviders(<SettingsScreen engine={engine} />);
    }).not.toThrow();
  });

  it('handles weekly target with unknown class — falls back to raw id', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_UNKNOWN_CLASS],
      activityClasses: [], // class not found
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText('cls-unknown-xyz')).toBeInTheDocument();
  });

  it('renders correctly with no active block and no previous blocks', () => {
    const noBlock = {
      id: '',
      userId: 'user-1',
      name: '',
      startDate: '1970-01-01' as TrainingBlock['startDate'],
      endDate: '1970-01-01' as TrainingBlock['endDate'],
      status: 'active' as const,
      isReviewMilestoneHit: false,
      createdAt: '1970-01-01T00:00:00Z',
    };

    const engine = makeEngine({
      block: noBlock,
      previousBlocks: [],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
      activities: [],
      logs: [],
    });

    expect(() => {
      renderWithProviders(<SettingsScreen engine={engine} />);
    }).not.toThrow();

    expect(screen.getByText(/no active training block/i)).toBeInTheDocument();
    expect(screen.queryByText(/previous blocks/i)).not.toBeInTheDocument();
  });
});
