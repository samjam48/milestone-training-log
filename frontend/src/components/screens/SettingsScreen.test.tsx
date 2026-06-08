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
import { screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
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
import { ApiError } from '../../lib/api/client';

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
  onViewBlock?: (blockId: string) => void;
  onOpenNewActivity?: () => void;
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

/** Previous-week list row (calendar label cell → inner column → flex row). */
function calendarWeekLabel(block: Pick<TrainingBlock, 'startDate' | 'endDate'>): string {
  const formatShort = (iso: string): string =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const endDate = block.endDate ?? block.startDate;
  return `${formatShort(block.startDate)} – ${formatShort(endDate)}`;
}

function previousWeekRowButton(block: Pick<TrainingBlock, 'startDate' | 'endDate'>): HTMLElement {
  const label = screen.getByText(calendarWeekLabel(block));
  const row = label.closest('button');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function withinPreviousWeekRow(block: Pick<TrainingBlock, 'startDate' | 'endDate'>) {
  return within(previousWeekRowButton(block));
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
  it('renders calendar week range when an active block exists', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(calendarWeekLabel(ACTIVE_BLOCK))).toBeInTheDocument();
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
// 2. Weekly targets list (P25.9: removed from block summary)
// ---------------------------------------------------------------------------

describe('SettingsScreen — Weekly Targets', () => {
  it('does not render weekly targets in the active block summary card', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSection = getSectionByHeading(/^weekly rules$/i);
    expect(within(blockSection).queryByText(/weekly targets/i)).not.toBeInTheDocument();
    expect(within(blockSection).queryByText(/weekly goal/i)).not.toBeInTheDocument();
    expect(within(blockSection).queryByText(/20/)).not.toBeInTheDocument();
  });

  it('does not list weekly target class names in block summary even when targets exist', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSection = getSectionByHeading(/^weekly rules$/i);
    expect(within(blockSection).queryByText('Running')).not.toBeInTheDocument();
    expect(within(blockSection).queryByText(/weekly targets/i)).not.toBeInTheDocument();
  });

  it('does not fall back to raw activityClassId in block summary when class is unknown', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_UNKNOWN_CLASS],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSection = getSectionByHeading(/^weekly rules$/i);
    expect(within(blockSection).queryByText('cls-unknown-xyz')).not.toBeInTheDocument();
    expect(within(blockSection).queryByText(/weekly targets/i)).not.toBeInTheDocument();
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

    // RULE_REST is rest_between_class with threshold 2
    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.rest_between_class, 'i')),
    ).toBeInTheDocument();
  });

  it('renders frequency_limit rule with correct label', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_FREQ],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    // frequency_limit with threshold 3
    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.frequency_limit, 'i')),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.rest_between_class, 'i')),
    ).toBeInTheDocument();
  });

  it('renders "All classes" label for rules with null activityClassId', () => {
    const crossClassRestRule: Rule = {
      ...RULE_REST,
      id: 'rule-cross-rest',
      activityClassId: null,
    };

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [crossClassRestRule],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/all classes/i)).toBeInTheDocument();
  });

  it('labels exercise-specific rules with the exercise name', () => {
    const exerciseRule: Rule = {
      ...RULE_FREQ,
      id: 'rule-run-frequency',
      activityId: ACTIVITY_RUNNING.id,
    };

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [exerciseRule],
      weeklyTargets: [],
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const recoveryRules = screen.getByText(/recovery rules/i).parentElement;
    expect(recoveryRules).not.toBeNull();
    expect(within(recoveryRules!).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(recoveryRules!).queryByText(CLASS_RUNNING.name)).not.toBeInTheDocument();
  });

  it('falls back to raw ruleType when rule type is not in taxonomy map', () => {
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
    periodKind: 'legacy' as const,
  };

  it('shows "No active training block" card when block id is empty', () => {
    const engine = makeEngine({
      block: noBlock,
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/no active weekly rules/i)).toBeInTheDocument();
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

describe('SettingsScreen — Previous weeks', () => {
  it('renders Previous weeks section from engine.previousBlocks', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/previous weeks/i)).toBeInTheDocument();
    expect(screen.getByText(calendarWeekLabel(PREVIOUS_BLOCK_1))).toBeInTheDocument();
  });

  it('renders only the most recent previous week inline when multiple exist', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1, PREVIOUS_BLOCK_2],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(calendarWeekLabel(PREVIOUS_BLOCK_1))).toBeInTheDocument();
    expect(screen.queryByText(calendarWeekLabel(PREVIOUS_BLOCK_2))).not.toBeInTheDocument();
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

    expect(previousWeekRowButton(PREVIOUS_BLOCK_1)).toBeInTheDocument();
  });

  it('does not render Previous weeks section when previousBlocks is empty', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(/^previous weeks$/i)).not.toBeInTheDocument();
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

    expect(screen.getByText(/^activities$/i)).toBeInTheDocument();
  });

  it('groups activities by class', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      activities: [ACTIVITY_RUNNING, ACTIVITY_STRENGTH],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const activitiesSection = getSectionByHeading(/^activities$/i);
    // Both class names should appear as group headers
    expect(within(activitiesSection).getByText('Running')).toBeInTheDocument();
    expect(within(activitiesSection).getByText('Strength')).toBeInTheDocument();
    // Both activity names should appear
    expect(within(activitiesSection).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(activitiesSection).getByText(ACTIVITY_STRENGTH.name)).toBeInTheDocument();
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

  it('calls onViewBlock with the previous block id when the inline week row is clicked', async () => {
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

    await user.click(previousWeekRowButton(PREVIOUS_BLOCK_1));

    expect(onViewBlock).toHaveBeenCalledTimes(1);
    expect(onViewBlock).toHaveBeenCalledWith(PREVIOUS_BLOCK_1.id);
  });

  it('opens the edit activity modal when Edit is clicked', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderSettingsScreenWithCallbacks({ engine });

    await user.click(screen.getByRole('button', { name: /edit morning run/i }));

    expect(
      screen.getByRole('dialog', { name: /edit activity/i }),
    ).toBeInTheDocument();
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
// Rule edit coverage: EditBlockRulesScreen.test.tsx.
// WRU.F2 — new-block create flow removed; see SettingsScreen.wruF1.test.tsx.
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

  it('does not render + New Training Block (WRU.F2)', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} onEditRules={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: /\+ new training block/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /new training block/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps the dev Reset mock data control when VITE_DEV_MODE is true', () => {
    vi.stubEnv('VITE_DEV_MODE', 'true');
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(
      <SettingsScreen
        engine={engine}
        onEditRules={vi.fn()}
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
    const createRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      createRule,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const metricSwitch = screen.getByRole('switch', { name: /metric units/i });
    await user.click(metricSwitch);

    expect(createRule).not.toHaveBeenCalled();
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
// F11.2 — Session logout (footer)
// ---------------------------------------------------------------------------
// Implementer: footer control calls apiFetch('/auth/logout', { method: 'POST' })
// and onUnauthenticated (App shows LoginScreen).
// ---------------------------------------------------------------------------

describe('SettingsScreen — F11.2 logout', () => {
  beforeEach(() => {
    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValue(undefined);
  });

  it('renders Log out in the Settings footer', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(<SettingsScreen engine={engine} onUnauthenticated={vi.fn()} />);

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('POSTs /auth/logout and calls onUnauthenticated when Log out is pressed', async () => {
    const user = userEvent.setup();
    const onUnauthenticated = vi.fn();
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(
      <SettingsScreen engine={engine} onUnauthenticated={onUnauthenticated} />,
    );

    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
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

  it('shows review milestone indicator on the inline previous week row when isReviewMilestoneHit is true', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      withinPreviousWeekRow(PREVIOUS_BLOCK_1).getByText(REVIEW_MILESTONE_BADGE),
    ).toBeInTheDocument();
  });

  it('allows an accessible label on previous-week milestone indicator (icon-only row)', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [PREVIOUS_BLOCK_1],
      rules: [],
      weeklyTargets: [],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      withinPreviousWeekRow(PREVIOUS_BLOCK_1).getByLabelText(REVIEW_MILESTONE_BADGE),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S2.6 — Create activity class (Settings)
// plans/tickets-stage-2-polish-2026-06-05.md
// ---------------------------------------------------------------------------

function renderStatefulActivityClassSettings(options: {
  activityClasses?: ActivityClass[];
} = {}) {
  let currentClasses = options.activityClasses ?? [];

  let renderApi = renderWithProviders(<div />);

  const submitNewActivityClass = vi.fn(async (
    draft: {
      name: string;
      type: ActivityClass['type'];
      description?: string;
      defaultRecoveryWindowDays?: number;
    },
  ) => {
    currentClasses = [
      ...currentClasses,
      {
        id: 'cls-new-test',
        userId: 'user-1',
        name: draft.name,
        type: draft.type,
        description: draft.description,
        defaultRecoveryWindowDays: draft.defaultRecoveryWindowDays ?? 3,
        createdAt: '2026-06-05T00:00:00Z',
      },
    ];
    rerenderCurrent();
  });

  const rerenderCurrent = () => {
    renderApi.rerender(
      <SettingsScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: currentClasses,
          activities: [],
          logs: [],
          submitNewActivityClass,
        } as Partial<typeof mockEngine>)}
      />,
    );
  };

  renderApi.unmount();
  renderApi = renderWithProviders(
    <SettingsScreen
      engine={makeEngine({
        block: ACTIVE_BLOCK,
        activityClasses: currentClasses,
        activities: [],
        logs: [],
        submitNewActivityClass,
      } as Partial<typeof mockEngine>)}
    />,
  );

  return { submitNewActivityClass };
}

describe('SettingsScreen — S2.6 create activity class', () => {
  it('renders an Activity classes section', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.getByText(/activity classes/i)).toBeInTheDocument();
  });

  it('renders a + New class control in the Activity classes section', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.getByRole('button', { name: /\+ new class/i }),
    ).toBeInTheDocument();
  });

  it('lists existing activity classes in the Activity classes section', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      activities: [],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const section = getSectionByHeading(/^activity classes$/i);
    expect(within(section).getByText(CLASS_RUNNING.name)).toBeInTheDocument();
    expect(within(section).getByText(CLASS_STRENGTH.name)).toBeInTheDocument();
  });

  it('opens the new-class form when + New class is clicked', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));

    expect(
      screen.getByRole('dialog', { name: /new activity class/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/class name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/performance/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^recovery$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recovery window/i)).toHaveValue(3);
  });

  it('calls engine.submitNewActivityClass with name, type, and default recovery window on submit', async () => {
    const user = userEvent.setup();
    const submitNewActivityClass = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
      submitNewActivityClass,
    } as Partial<typeof mockEngine>);

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));
    await user.type(screen.getByLabelText(/class name/i), 'Foot Load');
    await user.click(screen.getByLabelText(/performance/i));
    await user.click(screen.getByRole('button', { name: /create class/i }));

    expect(submitNewActivityClass).toHaveBeenCalledTimes(1);
    expect(submitNewActivityClass).toHaveBeenCalledWith({
      name: 'Foot Load',
      type: 'performance',
      defaultRecoveryWindowDays: 3,
    });
  });

  it('includes optional description when provided before submit', async () => {
    const user = userEvent.setup();
    const submitNewActivityClass = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
      submitNewActivityClass,
    } as Partial<typeof mockEngine>);

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));
    await user.type(screen.getByLabelText(/class name/i), 'Mobility');
    await user.click(screen.getByRole('radio', { name: /^recovery$/i }));
    await user.type(
      screen.getByLabelText(/description/i),
      'Stretching and mobility work',
    );
    await user.click(screen.getByRole('button', { name: /create class/i }));

    expect(submitNewActivityClass).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mobility',
        type: 'recovery',
        description: 'Stretching and mobility work',
      }),
    );
  });

  it('keeps Create disabled when class name is empty', async () => {
    const user = userEvent.setup();
    const submitNewActivityClass = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
      submitNewActivityClass,
    } as Partial<typeof mockEngine>);

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));

    const createButton = screen.getByRole('button', { name: /create class/i });
    expect(createButton).toBeDisabled();

    await user.click(createButton);
    expect(submitNewActivityClass).not.toHaveBeenCalled();
  });

  it('shows the new class in the Activity classes list after save without full page reload', async () => {
    const user = userEvent.setup();
    const { submitNewActivityClass } = renderStatefulActivityClassSettings({
      activityClasses: [],
    });

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));
    await user.type(screen.getByLabelText(/class name/i), 'Foot Load');
    await user.click(screen.getByLabelText(/performance/i));
    await user.click(screen.getByRole('button', { name: /create class/i }));

    expect(submitNewActivityClass).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Foot Load')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /new activity class/i }),
    ).not.toBeInTheDocument();
  });

  it('shows API error message when create fails with duplicate id', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockRejectedValueOnce(
      new (class ApiError extends Error {
        status: number;
        constructor(status: number, message: string) {
          super(message);
          this.status = status;
        }
      })(409, 'Activity class already exists'),
    );

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [],
      activities: [],
      logs: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));
    await user.type(screen.getByLabelText(/class name/i), 'Duplicate');
    await user.click(screen.getByLabelText(/performance/i));
    await user.click(screen.getByRole('button', { name: /create class/i }));

    expect(
      await screen.findByText(/activity class already exists/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S2.7 — New Activity entry (Settings)
// plans/tickets-stage-2-polish-2026-06-05.md
// ---------------------------------------------------------------------------

describe('SettingsScreen — S2.7 New Activity entry', () => {
  it('renders + New Activity in the Activities section', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onOpenNewActivity: vi.fn() });

    const activitiesSection = getSectionByHeading(/^activities$/i);
    expect(
      within(activitiesSection).getByRole('button', { name: /\+ new activity/i }),
    ).toBeInTheDocument();
  });

  it('calls onOpenNewActivity when + New Activity is clicked', async () => {
    const user = userEvent.setup();
    const onOpenNewActivity = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [],
      logs: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onOpenNewActivity });

    await user.click(screen.getByRole('button', { name: /\+ new activity/i }));

    expect(onOpenNewActivity).toHaveBeenCalledTimes(1);
  });

  it('shows + New Activity even when there are no activities yet', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [],
      logs: [],
    });

    renderSettingsScreenWithCallbacks({ engine, onOpenNewActivity: vi.fn() });

    expect(screen.getByRole('button', { name: /\+ new activity/i })).toBeInTheDocument();
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

  it('handles no previous blocks gracefully (no Previous weeks section)', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      previousBlocks: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(/^previous weeks$/i)).not.toBeInTheDocument();
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

  it('handles weekly target with unknown class without showing raw id in block summary', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_UNKNOWN_CLASS],
      activityClasses: [],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSection = getSectionByHeading(/^weekly rules$/i);
    expect(within(blockSection).queryByText('cls-unknown-xyz')).not.toBeInTheDocument();
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
      periodKind: 'legacy' as const,
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

    expect(screen.getByText(/no active weekly rules/i)).toBeInTheDocument();
    expect(screen.queryByText(/previous blocks/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S25.F8 — Activity class edit + delete
// ---------------------------------------------------------------------------

describe('SettingsScreen — S25.F8 activity class edit and delete', () => {
  it('opens edit sheet and PATCHes rename and type on save', async () => {
    const user = userEvent.setup();
    const updateActivityClass = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
      updateActivityClass,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /edit running/i }));

    expect(
      screen.getByRole('dialog', { name: /edit activity class/i }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/class name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Road Running');

    await user.click(screen.getByRole('radio', { name: /^recovery$/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(updateActivityClass).toHaveBeenCalledWith(CLASS_RUNNING.id, {
        name: 'Road Running',
        type: 'recovery',
      });
    });
  });

  it('two-step delete lists activity names before DELETE', async () => {
    const user = userEvent.setup();
    const deleteActivityClass = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING, ACTIVITY_INACTIVE],
      logs: [],
      deleteActivityClass,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /delete running/i }));
    expect(screen.getByText(/delete class\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete class$/i }));

    const deleteDialog = screen.getByRole('dialog', { name: /delete activity class/i });
    expect(within(deleteDialog).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(deleteDialog).getByText(ACTIVITY_INACTIVE.name)).toBeInTheDocument();
    expect(within(deleteDialog).getByText(/will be deleted/i)).toBeInTheDocument();
    expect(deleteActivityClass).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^delete anyway$/i }));

    await waitFor(() => {
      expect(deleteActivityClass).toHaveBeenCalledWith(CLASS_RUNNING.id);
    });
  });

  it('skips step two and DELETEs immediately when class has no activities', async () => {
    const user = userEvent.setup();
    const deleteActivityClass = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_STRENGTH],
      activities: [],
      logs: [],
      deleteActivityClass,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /delete strength/i }));
    await user.click(screen.getByRole('button', { name: /^delete class$/i }));

    await waitFor(() => {
      expect(deleteActivityClass).toHaveBeenCalledWith(CLASS_STRENGTH.id);
    });
    expect(screen.queryByText(/will be deleted/i)).not.toBeInTheDocument();
  });

  it('shows API message on 409 when activities have logs', async () => {
    const user = userEvent.setup();
    const deleteActivityClass = vi.fn().mockRejectedValue(
      new ApiError(409, 'Cannot delete class: Morning Run has logged sessions'),
    );
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [LOG_RECENT],
      deleteActivityClass,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /delete running/i }));
    await user.click(screen.getByRole('button', { name: /^delete class$/i }));
    await user.click(screen.getByRole('button', { name: /^delete anyway$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/cannot delete class: morning run has logged sessions/i),
      ).toBeInTheDocument();
    });
  });

  it('does not call delete when user cancels at step one', async () => {
    const user = userEvent.setup();
    const deleteActivityClass = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
      logs: [],
      deleteActivityClass,
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /delete running/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(deleteActivityClass).not.toHaveBeenCalled();
    expect(screen.queryByText(/delete class\?/i)).not.toBeInTheDocument();
  });
});
