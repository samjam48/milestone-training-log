import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

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
  defaultRecoveryWindowDays: 2,
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

const RULE_RUNNING_REST: Rule = {
  id: 'rule-running-rest',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_STRENGTH_FREQ: Rule = {
  id: 'rule-strength-freq',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_STRENGTH.id,
  ruleType: 'frequency_limit',
  thresholdValue: 3,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_ALL_CLASSES: Rule = {
  id: 'rule-all-classes',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: null,
  ruleType: 'weekly_activity_count',
  thresholdValue: 4,
  windowDays: 7,
  enabled: true,
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

describe('EditBlockRulesScreen', () => {
  it('groups rules by class and includes an All Classes group for null activityClassId rules', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      rules: [RULE_RUNNING_REST, RULE_STRENGTH_FREQ, RULE_ALL_CLASSES],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/running/i)).toBeInTheDocument();
    expect(screen.getByText(/strength/i)).toBeInTheDocument();
    expect(screen.getByText(/all classes/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no rules', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/no rules configured for this block/i)).toBeInTheDocument();
  });

  it('calls onBack when the Back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls engine.updateRule with the current displayed threshold on repeated stepper increases and omits add/delete controls', async () => {
    const user = userEvent.setup();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
      updateRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /add rule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

    const increaseButton = screen.getByRole('button', { name: /increase/i });
    await user.click(increaseButton);
    await user.click(increaseButton);

    expect(updateRule).toHaveBeenNthCalledWith(1, RULE_RUNNING_REST.id, {
      thresholdValue: 3,
    });
    expect(updateRule).toHaveBeenNthCalledWith(2, RULE_RUNNING_REST.id, {
      thresholdValue: 4,
    });
  });

  it('calls engine.updateRule with thresholdValue when the input is edited and blurred', async () => {
    const user = userEvent.setup();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
      updateRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    const thresholdInput = screen.getByRole('spinbutton');
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '4');
    await user.tab();

    expect(updateRule).toHaveBeenCalledWith(RULE_RUNNING_REST.id, {
      thresholdValue: 4,
    });
  });

  it('calls engine.updateRule with enabled when the toggle is clicked', async () => {
    const user = userEvent.setup();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
      updateRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('switch'));

    expect(updateRule).toHaveBeenCalledWith(RULE_RUNNING_REST.id, {
      enabled: false,
    });
  });
});
