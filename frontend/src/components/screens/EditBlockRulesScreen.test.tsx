import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
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

const RULE_RUNNING_FREQ: Rule = {
  id: 'rule-running-freq',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
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

const RULE_RUNNING_REST_DISABLED: Rule = {
  ...RULE_RUNNING_REST,
  enabled: false,
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

  it('calls engine.updateRule with the current displayed threshold on repeated stepper increases', async () => {
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

  it('exposes the threshold number input through the rule label as its accessible name', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('spinbutton', { name: 'Max sessions per week' }),
    ).toHaveValue(3);
  });

  it('renders the frequency-limit threshold unit with the prototype multiplication symbol', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('×/wk')).toBeInTheDocument();
    expect(screen.queryByText('x/wk')).not.toBeInTheDocument();
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

  it('hides threshold controls for disabled rules and keeps the summary copy visible', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST_DISABLED],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    const ruleToggle = screen.getByRole('switch');

    expect(ruleToggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('heading', { level: 2, name: 'Running' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /decrease/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /increase/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('days')).not.toBeInTheDocument();
  });

  it('restores threshold controls with the persisted value after a disabled rule is re-enabled', () => {
    const disabledEngine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST_DISABLED],
    });

    const { rerender } = renderWithProviders(
      <EditBlockRulesScreen
        engine={disabledEngine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    const enabledEngine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    rerender(
      <EditBlockRulesScreen
        engine={enabledEngine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
    expect(screen.getByRole('button', { name: /decrease/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /increase/i })).toBeInTheDocument();
    expect(screen.getByText('days')).toBeInTheDocument();
  });

  it('renders each activity-class section as dense grouped rows instead of standalone rule cards', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST, RULE_RUNNING_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    const runningSection = screen.getByRole('heading', { level: 2, name: 'Running' }).closest('section');

    expect(runningSection).not.toBeNull();
    expect(runningSection?.querySelector('.divide-y.divide-border-subtle')).not.toBeNull();
    expect(runningSection?.querySelectorAll('.rounded-lg.border.shadow-card').length).toBe(1);
    expect(screen.queryByText('Tune thresholds live for this rule group.')).not.toBeInTheDocument();
  });

  it('uses the approved prototype row labels and helper copy', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST, RULE_RUNNING_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Min rest between sessions')).toBeInTheDocument();
    expect(screen.getByText('Max sessions per week')).toBeInTheDocument();
    expect(screen.getAllByText('Running')).toHaveLength(3);
    expect(
      screen.queryByText('Minimum recovery time before this class repeats.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Maximum sessions in the rule window.')).not.toBeInTheDocument();
  });

  it('uses the prototype title casing for the screen heading', () => {
    const enabledEngine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={enabledEngine}
        onBack={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Edit Rules' }),
    ).toBeInTheDocument();
  });

  it('keeps the toggle knob fully inside the track in both states', () => {
    const enabledEngine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    const { rerender } = renderWithProviders(
      <EditBlockRulesScreen
        engine={enabledEngine}
        onBack={vi.fn()}
      />,
    );

    const enabledToggle = screen.getByRole('switch');
    const enabledKnob = enabledToggle.querySelector('span');

    expect(enabledToggle).toHaveClass('inline-flex', 'items-center', 'overflow-hidden');
    expect(enabledToggle).toHaveClass('h-6', 'w-10');
    expect(enabledKnob).not.toBeNull();
    expect(enabledKnob).toHaveClass('h-4', 'w-4', 'translate-x-5');

    const disabledEngine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST_DISABLED],
    });

    rerender(
      <EditBlockRulesScreen
        engine={disabledEngine}
        onBack={vi.fn()}
      />,
    );

    const disabledToggle = screen.getByRole('switch');
    const disabledKnob = disabledToggle.querySelector('span');

    expect(disabledToggle).toHaveClass('inline-flex', 'items-center', 'overflow-hidden');
    expect(disabledKnob).not.toBeNull();
    expect(disabledKnob).toHaveClass('translate-x-1');
  });
});

// ---------------------------------------------------------------------------
// F10.10 — Add/delete rules (ported from inline EditRulesForm)
// plans/tickets-phase-10-polish-2026-06-04.md §F10.10
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — F10.10 add and delete rules', () => {
  it('renders an Add rule control when rules exist', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
  });

  it('renders Add rule in the empty state when there are zero rules', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.getByText(/no rules configured for this block/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add rule/i })).toBeInTheDocument();
  });

  it('renders a delete control for each existing rule row', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST, RULE_RUNNING_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });

  it('calls engine.createRule when a new rule is added and confirmed', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [],
      createRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /add rule/i }));

    const typeSelect =
      screen.queryByRole('combobox', { name: /rule type/i }) ??
      screen.getByRole('combobox');
    await user.selectOptions(typeSelect, 'rest_between_class');

    const thresholdInput = screen.getByRole('spinbutton');
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '2');

    await user.click(screen.getByRole('button', { name: /save|confirm|add/i }));

    expect(createRule).toHaveBeenCalledTimes(1);
    const [draft] = createRule.mock.calls[0] as [RuleDraft];
    expect(draft.ruleType).toBe('rest_between_class');
    expect(draft.thresholdValue).toBe(2);
  });

  it('calls engine.deleteRule when delete is confirmed for a rule', async () => {
    const user = userEvent.setup();
    const deleteRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
      deleteRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(deleteRule).toHaveBeenCalledTimes(1);
    expect(deleteRule).toHaveBeenCalledWith(RULE_RUNNING_REST.id);
  });

  it('after deleting the first of two rules, editing the remaining rule updates the second rule id', async () => {
    const user = userEvent.setup();
    const deleteRule = vi.fn();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST, RULE_RUNNING_FREQ],
      deleteRule,
      updateRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[0]!);

    expect(deleteRule).toHaveBeenCalledWith(RULE_RUNNING_REST.id);

    const remainingInput = screen.getByRole('spinbutton', {
      name: 'Max sessions per week',
    });
    await user.clear(remainingInput);
    await user.type(remainingInput, '5');
    await user.tab();

    expect(updateRule).toHaveBeenCalledWith(RULE_RUNNING_FREQ.id, {
      thresholdValue: 5,
    });
  });
});

// ---------------------------------------------------------------------------
// F10.9 — Stack screen loading and error polish
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — F10.9 loading and error polish', () => {
  function renderRulesScreen(engineOverrides: Partial<MilestoneEngineResult> = {}) {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
      ...engineOverrides,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    return engine;
  }

  it('shows a loading skeleton while engine.isInitialLoading is true', () => {
    renderRulesScreen({ isInitialLoading: true });

    const loading = screen.getByTestId('stack-screen-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelector('.skeleton')).not.toBeNull();
  });

  it('hides rule editor content while engine.isInitialLoading is true', () => {
    renderRulesScreen({ isInitialLoading: true });

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByText(/min rest between sessions/i)).not.toBeInTheDocument();
  });

  it('shows an actionable error with Retry when engine.isFatalError is true', () => {
    renderRulesScreen({ isFatalError: true });

    expect(screen.getByTestId('stack-screen-error')).toHaveAttribute('role', 'alert');
    expect(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it('calls engine.refetchAll when Retry is pressed on a fatal error', async () => {
    const user = userEvent.setup();
    const refetchAll = vi.fn();
    renderRulesScreen({ isFatalError: true, refetchAll });

    await user.click(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    );

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('does not use viewport-height layout on the screen root', () => {
    renderRulesScreen();

    const root = screen.getByRole('heading', { name: 'Edit Rules' }).closest('section');
    expect(root).not.toBeNull();
    expect(root).not.toHaveClass('h-screen', 'min-h-screen');
    expect(root?.getAttribute('style') ?? '').not.toMatch(/100vh/i);
  });
});
