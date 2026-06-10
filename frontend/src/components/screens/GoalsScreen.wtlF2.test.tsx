/**
 * WTL.F2 — Goals screen weekly target flow (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F2
 *
 * Covers: dual bottom actions, weekly target editor, weekly targets section,
 * delete confirmation, and edge cases (no volume unit, recovery+performance,
 * duplicate inline error, save failure keeps editor open).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import {
  WTL_F2_ACTIVITY_STRETCH,
  WTL_F2_ACTIVITY_WALK,
  WTL_F2_BLOCK,
  WTL_F2_CLASS_FOOT,
  WTL_F2_CLASS_MOBILITY,
  WTL_F2_DUPLICATE_TARGET_ERROR,
  WTL_F2_WALK_PROGRESS,
  WTL_F2_WEEKLY_PROGRESS,
  WTL_F2_WEEKLY_TARGET_STRETCH,
  WTL_F2_WEEKLY_TARGET_WALK,
  type WeeklyTargetWtlF2,
} from '../../test/wtlF2WeeklyTargetFixtures';
import { GoalsScreen } from './GoalsScreen';

/** WTL.F2 engine extensions not yet on MilestoneEngineResult. */
type WtlF2Engine = MilestoneEngineResult & {
  deleteWeeklyTarget: (targetId: string) => void;
  weeklyTargetMutationPending: boolean;
  weeklyTargetMutationError: string | null;
  clearWeeklyTargetMutationError: () => void;
};

function makeWtlF2Engine(
  overrides: Partial<WtlF2Engine> = {},
): WtlF2Engine {
  return {
    ...mockEngine,
    block: WTL_F2_BLOCK,
    activityClasses: [WTL_F2_CLASS_FOOT, WTL_F2_CLASS_MOBILITY],
    activities: [WTL_F2_ACTIVITY_WALK, WTL_F2_ACTIVITY_STRETCH],
    weeklyTargets: [WTL_F2_WEEKLY_TARGET_WALK, WTL_F2_WEEKLY_TARGET_STRETCH],
    weeklyProgress: WTL_F2_WEEKLY_PROGRESS,
    createWeeklyTarget: vi.fn(),
    patchWeeklyTarget: vi.fn(),
    deleteWeeklyTarget: vi.fn(),
    weeklyTargetMutationPending: false,
    weeklyTargetMutationError: null,
    clearWeeklyTargetMutationError: vi.fn(),
    ...overrides,
  } as WtlF2Engine;
}

function getWeeklyTargetsSection(): HTMLElement {
  const section = screen.getByTestId('weekly-targets-section');
  return section;
}

function getWeeklyTargetEditor(): HTMLElement {
  return screen.getByTestId('weekly-target-editor');
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Bottom actions — Weekly target + Big goal
// ---------------------------------------------------------------------------

describe('GoalsScreen — WTL.F2 bottom actions', () => {
  it('renders Weekly target and Big goal actions in the bottom bar', () => {
    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /weekly target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /big goal/i })).toBeInTheDocument();
  });

  it('does not render the legacy "+ New Goal" CTA after WTL.F2', () => {
    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /\+ new goal/i })).not.toBeInTheDocument();
  });

  it('clicking Big goal calls onNewGoal and does not open the weekly target editor', async () => {
    const user = userEvent.setup();
    const onNewGoal = vi.fn();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={onNewGoal} />,
    );

    await user.click(screen.getByRole('button', { name: /big goal/i }));

    expect(onNewGoal).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('weekly-target-editor')).not.toBeInTheDocument();
  });

  it('clicking Weekly target opens the weekly target editor', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    expect(screen.getByTestId('weekly-target-editor')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Weekly target editor — activity, value, unit, save/cancel
// ---------------------------------------------------------------------------

describe('GoalsScreen — WTL.F2 weekly target editor', () => {
  it('editor includes an activity picker, target value field, unit selector, and save/cancel', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const editor = getWeeklyTargetEditor();
    expect(within(editor).getByRole('combobox', { name: /activity/i })).toBeInTheDocument();
    expect(within(editor).getByRole('spinbutton', { name: /target value/i })).toBeInTheDocument();
    expect(within(editor).getByRole('combobox', { name: /unit/i })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(within(editor).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('cancel closes the editor without calling createWeeklyTarget', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ createWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));
    await user.click(within(getWeeklyTargetEditor()).getByRole('button', { name: /cancel/i }));

    expect(createWeeklyTarget).not.toHaveBeenCalled();
    expect(screen.queryByTestId('weekly-target-editor')).not.toBeInTheDocument();
  });

  it('save calls createWeeklyTarget with activity_id, target value, and unit', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ createWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const editor = getWeeklyTargetEditor();
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_WALK.id,
    );
    await user.clear(within(editor).getByRole('spinbutton', { name: /target value/i }));
    await user.type(
      within(editor).getByRole('spinbutton', { name: /target value/i }),
      '10',
    );
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /unit/i }),
      'km',
    );
    await user.click(within(editor).getByRole('button', { name: /^save$/i }));

    expect(createWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(createWeeklyTarget).toHaveBeenCalledWith({
      activityId: WTL_F2_ACTIVITY_WALK.id,
      targetValue: 10,
      targetUnit: 'km',
    });
  });

  it('PDH.F1 disables Save while a weekly target create mutation is pending', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({
          createWeeklyTarget,
          weeklyTargetMutationPending: true,
        })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const editor = getWeeklyTargetEditor();
    const saveButton = within(editor).getByRole('button', { name: /^save$/i });

    expect(saveButton).toBeDisabled();

    await user.click(saveButton);

    expect(createWeeklyTarget).not.toHaveBeenCalled();
  });

  it('PDH.F1 rapid repeated Save submits at most one new weekly target create request', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ createWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const editor = getWeeklyTargetEditor();
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_WALK.id,
    );
    await user.clear(within(editor).getByRole('spinbutton', { name: /target value/i }));
    await user.type(
      within(editor).getByRole('spinbutton', { name: /target value/i }),
      '10',
    );
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /unit/i }),
      'km',
    );

    await user.dblClick(within(editor).getByRole('button', { name: /^save$/i }));

    expect(createWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(createWeeklyTarget).toHaveBeenCalledWith({
      activityId: WTL_F2_ACTIVITY_WALK.id,
      targetValue: 10,
      targetUnit: 'km',
    });
  });

  it('offers sessions, minutes, and the activity default volume unit when available', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));
    await user.selectOptions(
      within(getWeeklyTargetEditor()).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_WALK.id,
    );

    const unitSelect = within(getWeeklyTargetEditor()).getByRole('combobox', {
      name: /unit/i,
    });
    const options = within(unitSelect)
      .getAllByRole('option')
      .map((el) => el.textContent);

    expect(options).toEqual(expect.arrayContaining(['sessions', 'minutes', 'km']));
  });
});

// ---------------------------------------------------------------------------
// Weekly targets section — list, progress, edit, delete
// ---------------------------------------------------------------------------

describe('GoalsScreen — WTL.F2 weekly targets section', () => {
  it('renders a distinct Weekly targets section', () => {
    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    expect(screen.getByText(/weekly targets/i)).toBeInTheDocument();
    expect(screen.getByTestId('weekly-targets-section')).toBeInTheDocument();
  });

  it('weekly target cards show activity name, this-week progress, and target value/unit', () => {
    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    const section = getWeeklyTargetsSection();

    expect(within(section).getByText(WTL_F2_ACTIVITY_WALK.name)).toBeInTheDocument();
    expect(
      within(section).getByText(
        `${WTL_F2_WALK_PROGRESS.value} / ${WTL_F2_WALK_PROGRESS.target} ${WTL_F2_WALK_PROGRESS.unit}`,
      ),
    ).toBeInTheDocument();

    expect(within(section).getByText(WTL_F2_ACTIVITY_STRETCH.name)).toBeInTheDocument();
    expect(within(section).getByText(/2\s*\/\s*4\s*sessions/i)).toBeInTheDocument();
  });

  it('each weekly target card has edit and delete actions', () => {
    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    const section = getWeeklyTargetsSection();
    const editButtons = within(section).getAllByRole('button', { name: /^edit$/i });
    const deleteButtons = within(section).getAllByRole('button', { name: /^delete$/i });

    expect(editButtons.length).toBeGreaterThanOrEqual(2);
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('clicking edit opens the editor pre-filled for that weekly target', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    expect(walkCard).not.toBeNull();

    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^edit$/i }));

    const editor = getWeeklyTargetEditor();
    expect(within(editor).getByRole('combobox', { name: /activity/i })).toHaveValue(
      WTL_F2_ACTIVITY_WALK.id,
    );
    expect(within(editor).getByRole('spinbutton', { name: /target value/i })).toHaveValue(
      WTL_F2_WEEKLY_TARGET_WALK.targetValue,
    );
    expect(within(editor).getByRole('combobox', { name: /unit/i })).toHaveValue('km');
  });

  it('saving an edit calls patchWeeklyTarget with the target id and patch', async () => {
    const user = userEvent.setup();
    const patchWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ patchWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^edit$/i }));

    const editor = getWeeklyTargetEditor();
    await user.clear(within(editor).getByRole('spinbutton', { name: /target value/i }));
    await user.type(
      within(editor).getByRole('spinbutton', { name: /target value/i }),
      '12',
    );
    await user.click(within(editor).getByRole('button', { name: /^save$/i }));

    expect(patchWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(patchWeeklyTarget).toHaveBeenCalledWith(WTL_F2_WEEKLY_TARGET_WALK.id, {
      targetValue: 12,
    });
  });

  it('closes editor after successful edit when target value changes', async () => {
    const user = userEvent.setup();
    const patchWeeklyTarget = vi.fn();

    const { rerender } = renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ patchWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^edit$/i }));
    await user.click(within(getWeeklyTargetEditor()).getByRole('button', { name: /^save$/i }));

    expect(patchWeeklyTarget).toHaveBeenCalledTimes(1);

    rerender(
      <GoalsScreen
        engine={makeWtlF2Engine({
          patchWeeklyTarget,
          weeklyTargets: [
            { ...WTL_F2_WEEKLY_TARGET_WALK, targetValue: 12 },
            WTL_F2_WEEKLY_TARGET_STRETCH,
          ],
        })}
        onNewGoal={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('weekly-target-editor')).not.toBeInTheDocument();
  });

  it('closes editor after successful edit when activity changes', async () => {
    const user = userEvent.setup();
    const patchWeeklyTarget = vi.fn();

    const { rerender } = renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ patchWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^edit$/i }));

    const editor = getWeeklyTargetEditor();
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_STRETCH.id,
    );
    await user.click(within(editor).getByRole('button', { name: /^save$/i }));

    expect(patchWeeklyTarget).toHaveBeenCalledWith(WTL_F2_WEEKLY_TARGET_WALK.id, {
      targetValue: WTL_F2_WEEKLY_TARGET_WALK.targetValue,
      activityId: WTL_F2_ACTIVITY_STRETCH.id,
      targetUnit: 'sessions',
    });

    rerender(
      <GoalsScreen
        engine={makeWtlF2Engine({
          patchWeeklyTarget,
          weeklyTargets: [
            {
              ...WTL_F2_WEEKLY_TARGET_WALK,
              activityId: WTL_F2_ACTIVITY_STRETCH.id,
              activityName: WTL_F2_ACTIVITY_STRETCH.name,
              activityClassId: WTL_F2_CLASS_MOBILITY.id,
            },
            WTL_F2_WEEKLY_TARGET_STRETCH,
          ],
        })}
        onNewGoal={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('weekly-target-editor')).not.toBeInTheDocument();
  });

  it('closes editor after successful edit when unit changes', async () => {
    const user = userEvent.setup();
    const patchWeeklyTarget = vi.fn();

    const { rerender } = renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ patchWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^edit$/i }));

    const editor = getWeeklyTargetEditor();
    await user.selectOptions(
      within(editor).getByRole('combobox', { name: /unit/i }),
      'minutes',
    );
    await user.click(within(editor).getByRole('button', { name: /^save$/i }));

    expect(patchWeeklyTarget).toHaveBeenCalledWith(WTL_F2_WEEKLY_TARGET_WALK.id, {
      targetValue: WTL_F2_WEEKLY_TARGET_WALK.targetValue,
      targetUnit: 'minutes',
    });

    rerender(
      <GoalsScreen
        engine={makeWtlF2Engine({
          patchWeeklyTarget,
          weeklyTargets: [
            { ...WTL_F2_WEEKLY_TARGET_WALK, targetUnit: 'minutes' },
            WTL_F2_WEEKLY_TARGET_STRETCH,
          ],
        })}
        onNewGoal={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('weekly-target-editor')).not.toBeInTheDocument();
  });

  it('resets editor when switching from create to edit', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const createEditor = getWeeklyTargetEditor();
    await user.selectOptions(
      within(createEditor).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_STRETCH.id,
    );
    await user.type(
      within(createEditor).getByRole('spinbutton', { name: /target value/i }),
      '99',
    );

    const walkCard = screen.getByTestId(`weekly-target-card-${WTL_F2_WEEKLY_TARGET_WALK.id}`);
    await user.click(within(walkCard).getByRole('button', { name: /^edit$/i }));

    const editEditor = getWeeklyTargetEditor();
    expect(within(editEditor).getByRole('combobox', { name: /activity/i })).toHaveValue(
      WTL_F2_ACTIVITY_WALK.id,
    );
    expect(within(editEditor).getByRole('spinbutton', { name: /target value/i })).toHaveValue(
      WTL_F2_WEEKLY_TARGET_WALK.targetValue,
    );
    expect(within(editEditor).getByRole('combobox', { name: /unit/i })).toHaveValue('km');
  });

  it('resets editor when switching between edit targets', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    const walkCard = screen.getByTestId(`weekly-target-card-${WTL_F2_WEEKLY_TARGET_WALK.id}`);
    await user.click(within(walkCard).getByRole('button', { name: /^edit$/i }));

    const walkEditor = getWeeklyTargetEditor();
    await user.clear(within(walkEditor).getByRole('spinbutton', { name: /target value/i }));
    await user.type(
      within(walkEditor).getByRole('spinbutton', { name: /target value/i }),
      '99',
    );

    const stretchCard = screen.getByTestId(`weekly-target-card-${WTL_F2_WEEKLY_TARGET_STRETCH.id}`);
    await user.click(within(stretchCard).getByRole('button', { name: /^edit$/i }));

    const stretchEditor = getWeeklyTargetEditor();
    expect(within(stretchEditor).getByRole('combobox', { name: /activity/i })).toHaveValue(
      WTL_F2_ACTIVITY_STRETCH.id,
    );
    expect(within(stretchEditor).getByRole('spinbutton', { name: /target value/i })).toHaveValue(
      WTL_F2_WEEKLY_TARGET_STRETCH.targetValue,
    );
    expect(within(stretchEditor).getByRole('combobox', { name: /unit/i })).toHaveValue('sessions');
  });
});

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

describe('GoalsScreen — WTL.F2 delete weekly target confirmation', () => {
  it('does not call deleteWeeklyTarget immediately when Delete is clicked', async () => {
    const user = userEvent.setup();
    const deleteWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ deleteWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const deleteButtons = within(section).getAllByRole('button', { name: /^delete$/i });
    await user.click(deleteButtons[0]!);

    expect(deleteWeeklyTarget).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm delete/i)).toBeInTheDocument();
  });

  it('confirming delete calls deleteWeeklyTarget with the target id', async () => {
    const user = userEvent.setup();
    const deleteWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ deleteWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const walkCard = within(section)
      .getByText(WTL_F2_ACTIVITY_WALK.name)
      .closest('[data-testid^="weekly-target-card-"]');
    await user.click(within(walkCard as HTMLElement).getByRole('button', { name: /^delete$/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(deleteWeeklyTarget).toHaveBeenCalledTimes(1);
    expect(deleteWeeklyTarget).toHaveBeenCalledWith(WTL_F2_WEEKLY_TARGET_WALK.id);
  });

  it('cancelling delete confirmation does not call deleteWeeklyTarget', async () => {
    const user = userEvent.setup();
    const deleteWeeklyTarget = vi.fn();

    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ deleteWeeklyTarget })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    const deleteButtons = within(section).getAllByRole('button', { name: /^delete$/i });
    await user.click(deleteButtons[0]!);
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(deleteWeeklyTarget).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirm delete/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('GoalsScreen — WTL.F2 edge cases', () => {
  it('activity picker includes both recovery and performance activities', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));

    const activitySelect = within(getWeeklyTargetEditor()).getByRole('combobox', {
      name: /activity/i,
    });
    const optionLabels = within(activitySelect)
      .getAllByRole('option')
      .map((el) => el.textContent);

    expect(optionLabels).toEqual(
      expect.arrayContaining([WTL_F2_ACTIVITY_WALK.name, WTL_F2_ACTIVITY_STRETCH.name]),
    );
  });

  it('when activity has no default volume unit, unit options are sessions and minutes only', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GoalsScreen engine={makeWtlF2Engine()} onNewGoal={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));
    await user.selectOptions(
      within(getWeeklyTargetEditor()).getByRole('combobox', { name: /activity/i }),
      WTL_F2_ACTIVITY_STRETCH.id,
    );

    const unitSelect = within(getWeeklyTargetEditor()).getByRole('combobox', {
      name: /unit/i,
    });
    const options = within(unitSelect)
      .getAllByRole('option')
      .map((el) => el.textContent);

    expect(options).toEqual(expect.arrayContaining(['sessions', 'minutes']));
    expect(options).not.toEqual(expect.arrayContaining(['km']));
  });

  it('shows duplicate target API error inline in the editor', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();
    const clearWeeklyTargetMutationError = vi.fn();

    const { rerender } = renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({
          createWeeklyTarget,
          clearWeeklyTargetMutationError,
          weeklyTargetMutationError: null,
        })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));
    await user.click(within(getWeeklyTargetEditor()).getByRole('button', { name: /^save$/i }));

    expect(createWeeklyTarget).toHaveBeenCalledTimes(1);

    rerender(
      <GoalsScreen
        engine={makeWtlF2Engine({
          createWeeklyTarget,
          clearWeeklyTargetMutationError,
          weeklyTargetMutationError: WTL_F2_DUPLICATE_TARGET_ERROR,
        })}
        onNewGoal={vi.fn()}
      />,
    );

    const editor = getWeeklyTargetEditor();
    expect(within(editor).getByRole('alert')).toHaveTextContent(
      /weekly target already exists/i,
    );
    expect(within(editor).getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('save failure keeps the weekly target editor open', async () => {
    const user = userEvent.setup();
    const createWeeklyTarget = vi.fn();

    const { rerender } = renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({
          createWeeklyTarget,
          weeklyTargetMutationError: null,
        })}
        onNewGoal={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /weekly target/i }));
    await user.click(within(getWeeklyTargetEditor()).getByRole('button', { name: /^save$/i }));

    rerender(
      <GoalsScreen
        engine={makeWtlF2Engine({
          createWeeklyTarget,
          weeklyTargetMutationError: 'Failed to save weekly target',
        })}
        onNewGoal={vi.fn()}
      />,
    );

    expect(screen.getByTestId('weekly-target-editor')).toBeInTheDocument();
    expect(within(getWeeklyTargetEditor()).getByRole('alert')).toHaveTextContent(
      /failed to save weekly target/i,
    );
  });

  it('renders weekly targets section even when there are no big goals', () => {
    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({ goals: [] })}
        onNewGoal={vi.fn()}
      />,
    );

    expect(screen.getByTestId('weekly-targets-section')).toBeInTheDocument();
    expect(screen.getByText(WTL_F2_ACTIVITY_WALK.name)).toBeInTheDocument();
  });

  it('weekly targets section is empty when no weekly targets exist', () => {
    renderWithProviders(
      <GoalsScreen
        engine={makeWtlF2Engine({
          weeklyTargets: [] as WeeklyTargetWtlF2[],
          weeklyProgress: [],
        })}
        onNewGoal={vi.fn()}
      />,
    );

    const section = getWeeklyTargetsSection();
    expect(within(section).getByText(/no weekly targets/i)).toBeInTheDocument();
  });
});
