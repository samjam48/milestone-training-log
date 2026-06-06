import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock, WeeklyTarget } from '../../types';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
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
  it('renders a section for each class with performance classes before recovery', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_MOBILITY, CLASS_FOOT, CLASS_RUNNING],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen
        engine={engine}
        onBack={vi.fn()}
      />,
    );

    const classHeadings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(classHeadings).toEqual(['Foot load', 'Running', 'Mobility']);
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
      screen.getByRole('spinbutton', { name: P25_6_RULE_LABELS.frequency_limit }),
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

    const runningSection = screen.getByTestId(`class-rules-${CLASS_RUNNING.id}`);

    expect(runningSection.querySelector('.divide-y.divide-border-subtle')).not.toBeNull();
    expect(runningSection.querySelectorAll('.rounded-lg.border.shadow-card').length).toBeGreaterThanOrEqual(1);
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

    expect(screen.getByText(P25_6_RULE_LABELS.rest_between_class)).toBeInTheDocument();
    expect(screen.getByText(P25_6_RULE_LABELS.frequency_limit)).toBeInTheDocument();
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1);
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
  it('renders per-class add cap controls when rules exist', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_RUNNING_REST],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /add class cap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add exercise rule/i })).toBeInTheDocument();
  });

  it('renders per-class add controls when a class has zero rules', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /add class cap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add exercise rule/i })).toBeInTheDocument();
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

  it('calls engine.createRule with activityClassId when a class cap is added and confirmed', async () => {
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

    await user.click(screen.getByRole('button', { name: /add class cap/i }));

    const typeSelect =
      screen.queryByRole('combobox', { name: /rule type/i }) ??
      screen.getByRole('combobox');
    await user.selectOptions(typeSelect, 'rest_between_class');

    const thresholdInput = screen.getByRole('spinbutton');
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '2');

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createRule).toHaveBeenCalledTimes(1);
    const [draft] = createRule.mock.calls[0] as [RuleDraft];
    expect(draft.ruleType).toBe('rest_between_class');
    expect(draft.thresholdValue).toBe(2);
    expect(draft.activityClassId).toBe(CLASS_RUNNING.id);
    expect(draft.activityId).toBeUndefined();
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
      name: P25_6_RULE_LABELS.frequency_limit,
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
    expect(screen.queryByText(/minimum days between sessions/i)).not.toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// S25.F5 — Class sections, weekly targets, exercise rules
// plans/tickets-stage-2-5-usage-logic-2026-06-06.md §S25.F5
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — S25.F5 class sections, weekly targets, exercise rules', () => {
  it('shows Caps, Weekly goal, and Exercises subsections for performance classes', () => {
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
    expect(within(footSection).getByText('Weekly goal')).toBeInTheDocument();
    expect(within(footSection).getByText('Exercises')).toBeInTheDocument();
    expect(within(footSection).getByText('Walk')).toBeInTheDocument();
  });

  it('shows empty cap copy when a class has no class-level rules', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_WALK_CAP],
      weeklyTargets: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(
      within(footSection).getByText(/no limits — unlimited for this class/i),
    ).toBeInTheDocument();
  });

  it('hides Weekly goal for recovery classes unless a weekly target exists', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_MOBILITY, CLASS_FOOT],
      activities: [],
      rules: [],
      weeklyTargets: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const mobilitySection = screen.getByTestId(`class-rules-${CLASS_MOBILITY.id}`);
    expect(within(mobilitySection).queryByText('Weekly goal')).not.toBeInTheDocument();

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(within(footSection).getByText('Weekly goal')).toBeInTheDocument();
  });

  it('does not render cross-class weekly_activity_count rule types in the UI', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [],
      rules: [],
      weeklyTargets: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(screen.queryByText(/all classes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/weekly activity count/i)).not.toBeInTheDocument();

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    const addCapButton = within(footSection).getByRole('button', { name: /add class cap/i });
    expect(addCapButton).toBeInTheDocument();
  });

  it('calls engine.patchWeeklyTarget when weekly goal value is edited', async () => {
    const user = userEvent.setup();
    const patchWeeklyTarget = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [],
      weeklyTargets: [WEEKLY_TARGET_FOOT],
      patchWeeklyTarget,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    const weeklyInput = within(footSection).getByRole('spinbutton', { name: /weekly goal/i });
    await user.clear(weeklyInput);
    await user.type(weeklyInput, '12');
    await user.tab();

    expect(patchWeeklyTarget).toHaveBeenCalledWith(WEEKLY_TARGET_FOOT.id, {
      targetValue: 12,
    });
  });

  it('calls engine.createRule with activityClassId and activityId when adding an exercise rule', async () => {
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
    await user.click(within(footSection).getByRole('button', { name: /add exercise rule/i }));

    const activitySelect = within(footSection).getByRole('combobox', { name: /exercise/i });
    await user.selectOptions(activitySelect, ACTIVITY_WALK.id);

    const typeSelect = within(footSection).getByRole('combobox', { name: /rule type/i });
    await user.selectOptions(typeSelect, 'frequency_limit');

    const thresholdInput = within(footSection).getByRole('spinbutton', { name: /threshold/i });
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
