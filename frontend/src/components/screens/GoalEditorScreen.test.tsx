/**
 * F8.4 — GoalEditorScreen component tests (failing first, TDD).
 *
 * Tests are written against the public contract defined in the ticket:
 *
 *   Props:
 *     goal?:      Omit<Goal, 'userId'> | null
 *     engine:     MilestoneEngineResult
 *     onBack:     () => void
 *     onComplete: () => void
 *
 * The component (GoalEditorScreen.tsx) does NOT exist yet — all tests below
 * must fail until the implementation is in place.
 *
 * Production field names: progressValue / progressTarget / progressUnit
 * Mutations: engine.createGoal (create) / engine.updateGoal (edit)
 * Save guard: disabled until BOTH title and targetDate are filled.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { Goal, Activity, ActivityClass, ISODate } from '../../types';
import type { GoalDraft, GoalPatch, MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import {
  BOTTOM_ACTION_BAR_TEST_ID,
  expectSafeBottomOnlyInset,
  findSafeBottomOnlyRegion,
} from '../../test/bottomInsetLayout';
import { GoalEditorScreen } from './GoalEditorScreen';

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
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_WALK: Activity = {
  id: 'act-walk',
  userId: 'user-1',
  activityClassId: CLASS_RUNNING.id,
  name: 'Morning Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_JOG: Activity = {
  id: 'act-jog',
  userId: 'user-1',
  activityClassId: CLASS_RUNNING.id,
  name: 'Easy Jog',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_SQUAT: Activity = {
  id: 'act-squat',
  userId: 'user-1',
  activityClassId: CLASS_STRENGTH.id,
  name: 'Bodyweight Squat',
  type: 'performance',
  defaultVolumeUnit: 'reps',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

/** A goal with numeric progress — used for edit pre-fill tests. */
const GOAL_WITH_PROGRESS: Omit<Goal, 'userId'> = {
  id: 'goal-edit-1',
  title: 'Walk 50km this month',
  targetDate: '2026-06-30' as ISODate,
  timeframe: 'monthly',
  status: 'active',
  activityId: ACTIVITY_WALK.id,
  activityClassId: CLASS_RUNNING.id,
  progressValue: 20,
  progressTarget: 50,
  progressUnit: 'km',
  createdAt: '2026-05-01T00:00:00Z',
};

/** A qualitative goal (no progressTarget). */
const GOAL_QUALITATIVE: Omit<Goal, 'userId'> = {
  id: 'goal-edit-2',
  title: 'Complete rehab protocol',
  targetDate: '2026-07-31' as ISODate,
  timeframe: 'quarterly',
  status: 'active',
  createdAt: '2026-05-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helper — build an engine stub with overrides
// ---------------------------------------------------------------------------

function makeEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return { ...mockEngine, ...overrides };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Create — happy path
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Create: happy path', () => {
  it('calls engine.createGoal with a correctly shaped GoalDraft and then onComplete', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const onBack = vi.fn<() => void>();

    const engine = makeEngine({ createGoal, activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    // Fill title
    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'Run a 5k race');

    // Fill target date
    const dateInput = screen.getByLabelText(/target date/i);
    await user.type(dateInput, '2026-06-30');

    // Select monthly timeframe (expect it to be the default or selectable)
    const monthlyOption =
      screen.queryByRole('radio', { name: /monthly/i }) ??
      screen.queryByRole('button', { name: /monthly/i });
    if (monthlyOption) {
      await user.click(monthlyOption);
    }

    // Click Save
    const saveButton = screen.getByRole('button', { name: /save|create/i });
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    // createGoal called once with correct draft
    expect(createGoal).toHaveBeenCalledTimes(1);
    const draft = (createGoal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as GoalDraft;
    expect(draft.title).toBe('Run a 5k race');
    expect(draft.targetDate).toBe('2026-06-30');
    expect(draft.timeframe).toBe('monthly');
    expect(draft.status).toBe('active');
    expect((draft as unknown as Record<string, unknown>).id).toBeUndefined();

    // onComplete called after
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Create — numeric progress
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Create: numeric progress', () => {
  it('GoalDraft includes progressTarget and progressUnit when numeric toggle is on', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const onBack = vi.fn<() => void>();

    const engine = makeEngine({
      createGoal,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_WALK],
    });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    // Fill title
    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'Walk 100km this quarter');

    // Fill target date
    const dateInput = screen.getByLabelText(/target date/i);
    await user.type(dateInput, '2026-09-30');

    // Enable numeric progress toggle
    const progressToggle = screen.getByRole('switch', { name: /track numeric progress/i });
    await user.click(progressToggle);

    // Set progressTarget
    const targetInput =
      screen.getByRole('spinbutton', { name: /target/i }) ??
      screen.getByLabelText(/target/i);
    await user.clear(targetInput);
    await user.type(targetInput, '100');

    // Set unit to 'km' (click the km button or ensure it's selected)
    const kmButton =
      screen.queryByRole('button', { name: /^km$/i }) ??
      screen.queryByRole('radio', { name: /^km$/i });
    if (kmButton) {
      await user.click(kmButton);
    }

    await user.click(screen.getByRole('radio', { name: ACTIVITY_WALK.name }));

    // Save
    const saveButton = screen.getByRole('button', { name: /save|create/i });
    await user.click(saveButton);

    expect(createGoal).toHaveBeenCalledTimes(1);
    const draft = (createGoal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as GoalDraft;
    expect(draft.progressTarget).toBe(100);
    expect(draft.progressUnit).toBe('km');
    expect(draft.activityId).toBe(ACTIVITY_WALK.id);
    expect(draft.status).toBe('active');
    expect((draft as unknown as Record<string, unknown>).id).toBeUndefined();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Edit — pre-fill
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Edit: pre-fill form from goal prop', () => {
  it('title input is pre-filled with goal.title', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    expect(titleInput).toHaveValue(GOAL_WITH_PROGRESS.title);
  });

  it('timeframe segmented control reflects goal.timeframe', () => {
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_QUALITATIVE}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    // The quarterly option should be selected / active
    const quarterlyOption =
      screen.queryByRole('radio', { name: /quarterly/i }) ??
      screen.queryByRole('button', { name: /quarterly/i });
    expect(quarterlyOption).not.toBeNull();
    // It should reflect the selected state — aria-checked, aria-pressed, or aria-selected
    if (quarterlyOption) {
      const isSelected =
        quarterlyOption.getAttribute('aria-checked') === 'true' ||
        quarterlyOption.getAttribute('aria-pressed') === 'true' ||
        quarterlyOption.getAttribute('aria-selected') === 'true' ||
        quarterlyOption.classList.contains('selected') ||
        (quarterlyOption as HTMLInputElement).checked === true;
      expect(isSelected).toBe(true);
    }
  });

  it('targetDate input is pre-filled with goal.targetDate', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const dateInput = screen.getByLabelText(/target date/i);
    expect(dateInput).toHaveValue(GOAL_WITH_PROGRESS.targetDate);
  });

  it('numeric progress toggle is ON when goal.progressTarget is not null', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /track numeric progress/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('numeric progress toggle is OFF when goal.progressTarget is null/undefined', () => {
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_QUALITATIVE}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /track numeric progress/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

// ---------------------------------------------------------------------------
// 4. Edit — save changed field only
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Edit: save sends only changed fields', () => {
  it('calls engine.updateGoal(goal.id, patch) with only the changed title and then onComplete', async () => {
    const user = userEvent.setup();
    const updateGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const onBack = vi.fn<() => void>();

    const engine = makeEngine({
      updateGoal,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_WALK, ACTIVITY_JOG],
    });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    // Change only the title
    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title only');

    // Click Save
    const saveButton = screen.getByRole('button', { name: /save|create/i });
    await user.click(saveButton);

    expect(updateGoal).toHaveBeenCalledTimes(1);
    const [calledId, patch] = (updateGoal as ReturnType<typeof vi.fn>).mock.calls[0] as [string, GoalPatch];
    expect(calledId).toBe(GOAL_WITH_PROGRESS.id);
    expect(patch.title).toBe('Updated title only');

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Validation — Save disabled
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Validation: Save button disabled state', () => {
  it('Save button is disabled when title is empty (no date either)', () => {
    const createGoal = vi.fn<() => void>();
    const engine = makeEngine({ createGoal, activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save|create/i });
    expect(saveButton).toBeDisabled();
  });

  it('Save button is disabled when title is filled but targetDate is empty', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const engine = makeEngine({ createGoal, activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    await user.type(titleInput, 'Some goal with no date');

    const saveButton = screen.getByRole('button', { name: /save|create/i });
    expect(saveButton).toBeDisabled();

    // Confirm no mutation
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('Save button is disabled when targetDate is filled but title is empty', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const engine = makeEngine({ createGoal, activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const dateInput = screen.getByLabelText(/target date/i);
    await user.type(dateInput, '2026-08-01');

    const saveButton = screen.getByRole('button', { name: /save|create/i });
    expect(saveButton).toBeDisabled();

    // Confirm no mutation
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('Save button is enabled when both title and targetDate are filled', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const titleInput = screen.getByRole('textbox', { name: /title|goal/i });
    await user.type(titleInput, 'Valid goal');

    const dateInput = screen.getByLabelText(/target date/i);
    await user.type(dateInput, '2026-09-01');

    const saveButton = screen.getByRole('button', { name: /save|create/i });
    expect(saveButton).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 6. Back button
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — Back button', () => {
  it('clicking Back calls onBack with no mutation', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const updateGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const onBack = vi.fn<() => void>();

    const engine = makeEngine({ createGoal, updateGoal, activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(createGoal).not.toHaveBeenCalled();
    expect(updateGoal).not.toHaveBeenCalled();
  });

  it('Back button is present in edit mode too', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Header title reflects create vs edit mode
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — header title', () => {
  it('shows "New Goal" heading when no goal prop is passed', () => {
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText(/new goal/i)).toBeInTheDocument();
  });

  it('shows "Edit Goal" heading when a goal prop is passed', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText(/edit goal/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Activity class selector
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — activity class selector', () => {
  it('renders a "None" option in the activity class list', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING, CLASS_STRENGTH] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText(/none/i)).toBeInTheDocument();
  });

  it('renders each activityClass as a selectable option', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING, CLASS_STRENGTH] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText(CLASS_RUNNING.name)).toBeInTheDocument();
    expect(screen.getByText(CLASS_STRENGTH.name)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 9. Numeric progress fields hidden until toggle is enabled
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — numeric progress toggle', () => {
  it('progressTarget and progressUnit inputs are hidden when toggle is OFF', () => {
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    // In create mode, toggle starts OFF — number inputs should not be visible
    const targetInput = screen.queryByRole('spinbutton', { name: /target/i });
    expect(targetInput).not.toBeInTheDocument();
  });

  it('progressTarget input appears after toggling ON', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({ activityClasses: [] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn<() => void>()}
        onComplete={vi.fn<() => void>()}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /track numeric progress/i });
    await user.click(toggle);

    // Target input should now be visible
    const targetInput =
      screen.queryByRole('spinbutton', { name: /target/i }) ??
      screen.queryByLabelText(/target/i);
    expect(targetInput).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F10.9 — Stack screen loading and error polish
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — F10.9 loading and error polish', () => {
  it('shows a loading skeleton in create mode while engine.isInitialLoading is true', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING], isInitialLoading: true });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const loading = screen.getByTestId('stack-screen-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelector('.skeleton')).not.toBeNull();
  });

  it('hides the goal form in create mode while engine.isInitialLoading is true', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING], isInitialLoading: true });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByRole('textbox', { name: /title|goal/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/target date/i)).not.toBeInTheDocument();
  });

  it('does not show a loading skeleton in edit mode when a goal param is provided', () => {
    const engine = makeEngine({
      activityClasses: [CLASS_RUNNING],
      isInitialLoading: true,
    });

    renderWithProviders(
      <GoalEditorScreen
        goal={GOAL_WITH_PROGRESS}
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('stack-screen-loading')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Walk 50km this month')).toBeInTheDocument();
  });

  it('shows an actionable error with Retry when engine.isFatalError is true', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING], isFatalError: true });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('stack-screen-error')).toHaveAttribute('role', 'alert');
    expect(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it('calls engine.refetchAll when Retry is pressed on a fatal error', async () => {
    const user = userEvent.setup();
    const refetchAll = vi.fn();
    const engine = makeEngine({
      activityClasses: [CLASS_RUNNING],
      isFatalError: true,
      refetchAll,
    });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    );

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('does not use viewport-height layout on the screen root', () => {
    const engine = makeEngine({ activityClasses: [CLASS_RUNNING] });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    let node: HTMLElement | null = screen.getByRole('heading', { name: /new goal/i });
    let screenRoot: HTMLElement | null = null;
    while (node != null) {
      if (node.classList.contains('bg-bg') && node.classList.contains('flex-col')) {
        screenRoot = node;
      }
      node = node.parentElement;
    }

    expect(screenRoot).not.toBeNull();
    expect(screenRoot).not.toHaveClass('h-screen', 'min-h-screen');
    expect(screenRoot?.getAttribute('style') ?? '').not.toMatch(/100vh/i);
  });
});

// ---------------------------------------------------------------------------
// S25.F1 — Goal editor UX (plans/tickets-stage-2-5-usage-logic-2026-06-06.md)
// ---------------------------------------------------------------------------

describe('GoalEditorScreen — S25.F1 Goal editor UX', () => {
  function getStickySaveRegion(): HTMLElement {
    const saveButton = screen.getByRole('button', { name: /^(save|create)$/i });
    const byTestId = screen.queryByTestId(BOTTOM_ACTION_BAR_TEST_ID);
    if (byTestId !== null && byTestId.contains(saveButton)) {
      return byTestId;
    }
    const region = findSafeBottomOnlyRegion(saveButton);
    expect(region).not.toBeNull();
    return region as HTMLElement;
  }

  function makeGoalEditorEngine(
    overrides: Partial<MilestoneEngineResult> = {},
  ): MilestoneEngineResult {
    return makeEngine({
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
      activities: [ACTIVITY_WALK, ACTIVITY_JOG, ACTIVITY_SQUAT],
      ...overrides,
    });
  }

  it('places primary Save/Create CTA in a sticky bottom bar with safe-bottom inset', () => {
    const engine = makeGoalEditorEngine();

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const region = getStickySaveRegion();
    expectSafeBottomOnlyInset(region);
    expect(region.className).toMatch(/shrink-0/);
    expect(
      within(region).getByRole('button', { name: /^(save|create)$/i }),
    ).toBeInTheDocument();
  });

  it('does not render Save/Create in the header', () => {
    const engine = makeGoalEditorEngine();

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const header = screen.getByRole('heading', { name: /new goal/i }).closest('header');
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).queryByRole('button', { name: /^(save|create)$/i }),
    ).not.toBeInTheDocument();
  });

  it('renders selectable activities grouped under class headings instead of a class-only picker', () => {
    const engine = makeGoalEditorEngine();

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByText(/activity class/i)).not.toBeInTheDocument();

    expect(screen.getByRole('group', { name: CLASS_RUNNING.name })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: CLASS_STRENGTH.name })).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: ACTIVITY_WALK.name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: ACTIVITY_JOG.name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: ACTIVITY_SQUAT.name })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: CLASS_RUNNING.name })).not.toBeInTheDocument();
  });

  it('defaults Track automatically toggle to off on new goals', () => {
    const engine = makeGoalEditorEngine();

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('switch', { name: /track automatically/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('cannot save when auto-track is on without a selected activity', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const engine = makeGoalEditorEngine({ createGoal });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /title|goal/i }), 'Auto-tracked km goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');

    await user.click(screen.getByRole('switch', { name: /track automatically/i }));

    const targetInput =
      screen.getByRole('spinbutton', { name: /target/i }) ??
      screen.getByLabelText(/^target$/i);
    await user.clear(targetInput);
    await user.type(targetInput, '50');

    const kmUnit =
      screen.queryByRole('radio', { name: /^km$/i }) ??
      screen.queryByRole('button', { name: /^km$/i });
    if (kmUnit) {
      await user.click(kmUnit);
    }

    const saveButton = screen.getByRole('button', { name: /^(save|create)$/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/select an activity/i)).toBeInTheDocument();

    await user.click(saveButton);

    expect(createGoal).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows inline validation when auto-track is on but target is missing', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const engine = makeGoalEditorEngine({ createGoal });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /title|goal/i }), 'Auto-tracked goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');
    await user.click(screen.getByRole('switch', { name: /track automatically/i }));
    await user.click(screen.getByRole('radio', { name: ACTIVITY_WALK.name }));

    const saveButton = screen.getByRole('button', { name: /^(save|create)$/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/enter a target/i)).toBeInTheDocument();
    expect(createGoal).not.toHaveBeenCalled();
  });

  it('cannot save numeric progress goal without a selected activity', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const engine = makeGoalEditorEngine({ createGoal });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /title|goal/i }), 'Manual km goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');
    await user.click(screen.getByRole('switch', { name: /track numeric progress/i }));

    const targetInput =
      screen.getByRole('spinbutton', { name: /target/i }) ??
      screen.getByLabelText(/^target$/i);
    await user.clear(targetInput);
    await user.type(targetInput, '50');

    const saveButton = screen.getByRole('button', { name: /^(save|create)$/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/select an activity/i)).toBeInTheDocument();

    await user.click(saveButton);

    expect(createGoal).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('createGoal payload includes activityId and autoTrackProgress when both are set', async () => {
    const user = userEvent.setup();
    const createGoal = vi.fn<() => void>();
    const onComplete = vi.fn<() => void>();
    const engine = makeGoalEditorEngine({ createGoal });

    renderWithProviders(
      <GoalEditorScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /title|goal/i }), 'Auto-tracked walk goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');
    await user.click(screen.getByRole('switch', { name: /track automatically/i }));
    await user.click(screen.getByRole('radio', { name: ACTIVITY_WALK.name }));

    const targetInput =
      screen.getByRole('spinbutton', { name: /target/i }) ??
      screen.getByLabelText(/^target$/i);
    await user.clear(targetInput);
    await user.type(targetInput, '50');

    const kmUnit =
      screen.queryByRole('radio', { name: /^km$/i }) ??
      screen.queryByRole('button', { name: /^km$/i });
    if (kmUnit) {
      await user.click(kmUnit);
    }

    const saveButton = screen.getByRole('button', { name: /^(save|create)$/i });
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    expect(createGoal).toHaveBeenCalledTimes(1);
    const draft = (createGoal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as GoalDraft;
    expect(draft.activityId).toBe(ACTIVITY_WALK.id);
    expect(draft.autoTrackProgress).toBe(true);
    expect(draft.progressTarget).toBe(50);
    expect(draft.progressUnit).toBe('km');
    expect(draft.activityClassId).toBe(CLASS_RUNNING.id);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
