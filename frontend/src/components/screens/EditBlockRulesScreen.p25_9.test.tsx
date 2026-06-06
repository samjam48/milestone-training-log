/**
 * P25.9 — Remove weekly goal from Edit Rules
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: weekly goals belong on Goals tab only; Edit Rules is caps only.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock, WeeklyTarget } from '../../types';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

const CLASS_FOOT: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_MOBILITY: ActivityClass = {
  id: 'cls-mobility',
  userId: 'user-1',
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

const ACTIVITY_WALK: Activity = {
  id: 'act-walk',
  userId: 'user-1',
  activityClassId: CLASS_FOOT.id,
  name: 'Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const RULE_FOOT_FREQ: Rule = {
  id: 'rule-foot-freq',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  ruleType: 'frequency_limit',
  thresholdValue: 3,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_WALK_CAP: Rule = {
  id: 'rule-walk-cap',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  activityId: ACTIVITY_WALK.id,
  ruleType: 'frequency_limit',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const WEEKLY_TARGET_FOOT: WeeklyTarget = {
  id: 'wt-foot',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  targetValue: 10,
  targetUnit: 'km',
  createdAt: '2026-06-01T00:00:00Z',
};

function makeEngine(overrides: Partial<MilestoneEngineResult> = {}): MilestoneEngineResult {
  return {
    ...mockEngine,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('EditBlockRulesScreen — P25.9 remove weekly goal', () => {
  it('does not render Weekly goal subsection for performance classes without a target', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_FOOT_FREQ, RULE_WALK_CAP],
      weeklyTargets: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(within(footSection).queryByText('Weekly goal')).not.toBeInTheDocument();
    expect(
      within(footSection).queryByText(/no weekly goal set/i),
    ).not.toBeInTheDocument();
    expect(
      within(footSection).queryByRole('button', { name: /add weekly goal/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render Weekly goal subsection when a weekly target exists in engine data', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_FOOT_FREQ],
      weeklyTargets: [WEEKLY_TARGET_FOOT],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(within(footSection).queryByText('Weekly goal')).not.toBeInTheDocument();
    expect(
      within(footSection).queryByRole('spinbutton', { name: /weekly goal/i }),
    ).not.toBeInTheDocument();
    expect(
      within(footSection).queryByRole('combobox', { name: /weekly goal unit/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render Weekly goal for recovery classes even when a weekly target row exists', () => {
    const weeklyTargetMobility: WeeklyTarget = {
      ...WEEKLY_TARGET_FOOT,
      id: 'wt-mobility',
      activityClassId: CLASS_MOBILITY.id,
    };

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_MOBILITY, CLASS_FOOT],
      activities: [],
      rules: [],
      weeklyTargets: [weeklyTargetMobility],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const mobilitySection = screen.getByTestId(`class-rules-${CLASS_MOBILITY.id}`);
    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);

    expect(within(mobilitySection).queryByText('Weekly goal')).not.toBeInTheDocument();
    expect(within(footSection).queryByText('Weekly goal')).not.toBeInTheDocument();
  });

  it('does not expose weekly target mutation controls on Edit Rules', () => {
    const createWeeklyTarget = vi.fn();
    const patchWeeklyTarget = vi.fn();

    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [],
      rules: [],
      weeklyTargets: [],
      createWeeklyTarget,
      patchWeeklyTarget,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(
      within(footSection).queryByRole('button', { name: /add weekly goal/i }),
    ).not.toBeInTheDocument();
    expect(createWeeklyTarget).not.toHaveBeenCalled();
    expect(patchWeeklyTarget).not.toHaveBeenCalled();
  });
});

describe('EditBlockRulesScreen — P25.9 class caps / exercise rules regression', () => {
  it('still shows Caps and Exercises subsections for performance classes', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_FOOT_FREQ, RULE_WALK_CAP],
      weeklyTargets: [WEEKLY_TARGET_FOOT],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(within(footSection).getByText('Caps')).toBeInTheDocument();
    expect(within(footSection).getByText('Exercises')).toBeInTheDocument();
    expect(within(footSection).getByText('Walk')).toBeInTheDocument();
    expect(
      within(footSection).getAllByText(/maximum sessions per week/i).length,
    ).toBeGreaterThan(0);
  });

  it('still allows adding a class cap', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [],
      rules: [],
      createRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    await user.click(
      within(footSection).getByRole('button', { name: /add class cap/i }),
    );

    const thresholdInput = within(footSection).getByRole('spinbutton', {
      name: /threshold/i,
    });
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '2');
    await user.click(within(footSection).getByRole('button', { name: /save/i }));

    expect(createRule).toHaveBeenCalledTimes(1);
    const [draft] = createRule.mock.calls[0] as [RuleDraft];
    expect(draft.activityClassId).toBe(CLASS_FOOT.id);
    expect(draft.ruleType).toBe('rest_between_class');
    expect(draft.thresholdValue).toBe(2);
  });

  it('still allows adding an exercise rule', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [],
      createRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    await user.click(
      within(footSection).getByRole('button', { name: /add exercise rule/i }),
    );

    await user.selectOptions(
      within(footSection).getByRole('combobox', { name: /exercise/i }),
      ACTIVITY_WALK.id,
    );
    await user.selectOptions(
      within(footSection).getByRole('combobox', { name: /rule type/i }),
      'frequency_limit',
    );

    const thresholdInput = within(footSection).getByRole('spinbutton', {
      name: /threshold/i,
    });
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '2');
    await user.click(within(footSection).getByRole('button', { name: /save/i }));

    expect(createRule).toHaveBeenCalledTimes(1);
    const [draft] = createRule.mock.calls[0] as [RuleDraft];
    expect(draft.activityClassId).toBe(CLASS_FOOT.id);
    expect(draft.activityId).toBe(ACTIVITY_WALK.id);
    expect(draft.ruleType).toBe('frequency_limit');
    expect(draft.thresholdValue).toBe(2);
  });
});
