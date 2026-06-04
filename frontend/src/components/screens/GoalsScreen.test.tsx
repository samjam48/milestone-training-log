/**
 * F2.2 — GoalsScreen component tests (failing first, TDD).
 *
 * Tests are written against the public contract defined in the ticket:
 *   Props: { engine: MilestoneEngineResult }
 *
 * The component (GoalsScreen.tsx) does NOT exist yet — all tests below
 * must fail until the implementation is in place.
 *
 * Spec: export/preview/GoalsScreen.jsx, MOCKUPS.md §Screen 4
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { Goal, ActivityClass } from '../../types';
import type { GoalDraft } from '../../hooks/useMilestoneEngine';
import { GoalsScreen } from './GoalsScreen';

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

const GOAL_MONTHLY_NUMERIC: Omit<Goal, 'userId'> = {
  id: 'goal-monthly-1',
  title: 'Run 50km in May',
  targetDate: '2026-05-31',
  timeframe: 'monthly',
  status: 'active',
  activityClassId: CLASS_RUNNING.id,
  progressValue: 20,
  progressTarget: 50,
  progressUnit: 'km',
  createdAt: '2026-05-01T00:00:00Z',
};

const GOAL_MONTHLY_QUALITATIVE: Omit<Goal, 'userId'> = {
  id: 'goal-monthly-2',
  title: 'Complete rehab protocol',
  targetDate: '2026-05-31',
  timeframe: 'monthly',
  status: 'active',
  createdAt: '2026-05-01T00:00:00Z',
};

const GOAL_QUARTERLY_NUMERIC: Omit<Goal, 'userId'> = {
  id: 'goal-quarterly-1',
  title: 'Walk 200km without flare-up',
  targetDate: '2026-06-30',
  timeframe: 'quarterly',
  status: 'active',
  activityClassId: CLASS_RUNNING.id,
  progressValue: 80,
  progressTarget: 200,
  progressUnit: 'km',
  createdAt: '2026-04-01T00:00:00Z',
};

const GOAL_QUARTERLY_NO_CLASS: Omit<Goal, 'userId'> = {
  id: 'goal-quarterly-2',
  title: 'Maintain training consistency',
  targetDate: '2026-06-30',
  timeframe: 'quarterly',
  status: 'active',
  createdAt: '2026-04-01T00:00:00Z',
};

const GOAL_ACHIEVED: Omit<Goal, 'userId'> = {
  id: 'goal-achieved-1',
  title: 'Finish first 5k',
  targetDate: '2026-04-30',
  timeframe: 'monthly',
  status: 'achieved',
  progressValue: 5,
  progressTarget: 5,
  progressUnit: 'km',
  createdAt: '2026-04-01T00:00:00Z',
};

const GOAL_ACHIEVED_2: Omit<Goal, 'userId'> = {
  id: 'goal-achieved-2',
  title: 'No pain week',
  targetDate: '2026-04-15',
  timeframe: 'monthly',
  status: 'achieved',
  createdAt: '2026-04-01T00:00:00Z',
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

// ---------------------------------------------------------------------------
// 1. Header count: "N active · M achieved"
// ---------------------------------------------------------------------------

describe('GoalsScreen — header count', () => {
  it('renders "N active · M achieved" count in the header', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_QUARTERLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // 2 active goals, 1 achieved
    expect(screen.getByText(/2 active/i)).toBeInTheDocument();
    expect(screen.getByText(/1 achieved/i)).toBeInTheDocument();
  });

  it('shows "0 active" when no active goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_ACHIEVED],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/0 active/i)).toBeInTheDocument();
  });

  it('omits the achieved count when there are no achieved goals', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(/achieved/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2–4. Groups active goals by timeframe
// ---------------------------------------------------------------------------

describe('GoalsScreen — timeframe grouping', () => {
  it('renders a "This month" section for monthly goals', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/this month/i)).toBeInTheDocument();
  });

  it('renders a "This quarter" section for quarterly goals', () => {
    const engine = makeEngine({
      goals: [GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/this quarter/i)).toBeInTheDocument();
  });

  it('"This month" section shows only monthly active goals', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    const monthlySection = screen.getByText(/this month/i).closest('section');
    expect(monthlySection).not.toBeNull();
    const monthly = monthlySection as HTMLElement;

    expect(within(monthly).getByText(GOAL_MONTHLY_NUMERIC.title)).toBeInTheDocument();
    expect(within(monthly).queryByText(GOAL_QUARTERLY_NUMERIC.title)).not.toBeInTheDocument();
  });

  it('"This quarter" section shows only quarterly active goals', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    const quarterlySection = screen.getByText(/this quarter/i).closest('section');
    expect(quarterlySection).not.toBeNull();
    const quarterly = quarterlySection as HTMLElement;

    expect(within(quarterly).getByText(GOAL_QUARTERLY_NUMERIC.title)).toBeInTheDocument();
    expect(within(quarterly).queryByText(GOAL_MONTHLY_NUMERIC.title)).not.toBeInTheDocument();
  });

  it('does not render "This month" section when no monthly goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(/this month/i)).not.toBeInTheDocument();
  });

  it('does not render "This quarter" section when no quarterly goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(/this quarter/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5–7. Achieved section — collapsed by default, toggle, content
// ---------------------------------------------------------------------------

describe('GoalsScreen — Achieved section', () => {
  it('renders an "Achieved" toggle button when achieved goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /achieved/i })).toBeInTheDocument();
  });

  it('achieved section is collapsed by default (achieved goal titles not visible)', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // The achieved goal title should NOT be visible initially
    expect(screen.queryByText(GOAL_ACHIEVED.title)).not.toBeInTheDocument();
  });

  it('clicking the Achieved toggle expands the section', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /achieved/i }));

    expect(screen.getByText(GOAL_ACHIEVED.title)).toBeInTheDocument();
  });

  it('clicking the Achieved toggle again collapses the section', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Expand
    await user.click(screen.getByRole('button', { name: /achieved/i }));
    expect(screen.getByText(GOAL_ACHIEVED.title)).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByRole('button', { name: /achieved/i }));
    expect(screen.queryByText(GOAL_ACHIEVED.title)).not.toBeInTheDocument();
  });

  it('expanded Achieved section shows only achieved goals (status === "achieved")', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED, GOAL_ACHIEVED_2],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /achieved/i }));

    // Both achieved goals should appear
    expect(screen.getByText(GOAL_ACHIEVED.title)).toBeInTheDocument();
    expect(screen.getByText(GOAL_ACHIEVED_2.title)).toBeInTheDocument();
    // Active goal should NOT appear inside the achieved section
    // (it appears in "This month" — but we verify it's still only once total)
    expect(screen.getAllByText(GOAL_MONTHLY_NUMERIC.title)).toHaveLength(1);
  });

  it('does not render the Achieved section when no achieved goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByRole('button', { name: /achieved/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8–15. GoalCard rendering
// ---------------------------------------------------------------------------

describe('GoalsScreen — GoalCard title', () => {
  it('renders the goal title in the card', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(GOAL_MONTHLY_NUMERIC.title)).toBeInTheDocument();
  });
});

describe('GoalsScreen — GoalCard class chip', () => {
  it('renders a class chip when activityClassId is present and the class is found', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],   // has activityClassId: 'cls-running'
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // The class chip should show the class name
    expect(screen.getByText(CLASS_RUNNING.name)).toBeInTheDocument();
  });

  it('does not render a class chip when activityClassId is absent', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_QUALITATIVE],  // no activityClassId
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(CLASS_RUNNING.name)).not.toBeInTheDocument();
  });

  it('does not render a class chip when activityClassId does not match any class', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],   // activityClassId: 'cls-running'
      activityClasses: [CLASS_STRENGTH], // only strength — no running
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(CLASS_RUNNING.name)).not.toBeInTheDocument();
    expect(screen.queryByText(CLASS_STRENGTH.name)).not.toBeInTheDocument();
  });
});

describe('GoalsScreen — GoalCard progress', () => {
  it('renders a progress bar when progressValue and progressTarget are present', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],   // progressValue: 20, progressTarget: 50
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Progress bar should be present — query by role or value text
    // value text: "20 / 50 km"
    expect(screen.getByText(/20\s*\/\s*50/i)).toBeInTheDocument();
  });

  it('shows a "Qualitative" placeholder when no progressTarget is set', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_QUALITATIVE],  // no progressTarget
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/qualitative/i)).toBeInTheDocument();
  });

  it('does not show progress value text for qualitative goals', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_QUALITATIVE],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // There should be no "N / M" pattern
    expect(screen.queryByText(/\d+\s*\/\s*\d+/)).not.toBeInTheDocument();
  });
});

describe('GoalsScreen — GoalCard due date', () => {
  it('displays the due date formatted in UTC', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],  // targetDate: '2026-05-31'
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Expected UTC format: "May 31" (locale-dependent short month + day)
    // The prototype uses: new Date(targetDate + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    // We test for the presence of the "Due" prefix and a date-like string
    expect(screen.getByText(/due/i)).toBeInTheDocument();
    // The date part should include "31" (the day)
    expect(screen.getByText(/31/)).toBeInTheDocument();
  });

  it('formats targetDate using UTC timezone (not local)', () => {
    const engine = makeEngine({
      // Use a date where off-by-one would be visible: Jan 1
      goals: [{
        ...GOAL_MONTHLY_NUMERIC,
        targetDate: '2026-06-30',
      }],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Should show "30" (the UTC day), not "29" (which could appear in some time zones)
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });
});

describe('GoalsScreen — GoalCard Archive action', () => {
  it('renders an Archive button on active goal cards', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
  });

  it('calls engine.archiveGoal with the goal id when Archive is clicked', async () => {
    const user = userEvent.setup();
    const archiveGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
      archiveGoal,
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Step 1: click Archive — shows confirmation UI, does NOT call archiveGoal yet
    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(archiveGoal).not.toHaveBeenCalled();

    // Step 2: click Confirm — archiveGoal is now called with the correct id
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(archiveGoal).toHaveBeenCalledTimes(1);
    expect(archiveGoal).toHaveBeenCalledWith(GOAL_MONTHLY_NUMERIC.id);
  });
});

describe('GoalsScreen — GoalCard Edit action', () => {
  it('renders an Edit button on active goal cards', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 16–17. Empty state
// ---------------------------------------------------------------------------

describe('GoalsScreen — empty state', () => {
  it('shows "No goals yet" message when there are no active goals', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });

  it('shows "No goals yet" when only achieved goals exist (no active)', () => {
    const engine = makeEngine({
      goals: [GOAL_ACHIEVED],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });

  it('does NOT show "No goals yet" when active goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByText(/no goals yet/i)).not.toBeInTheDocument();
  });

  it('still shows "+ New Goal" CTA in the empty state', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /\+ new goal/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F10.8 — Illustrated empty state
// ---------------------------------------------------------------------------

describe('GoalsScreen — F10.8 illustrated empty state', () => {
  it('renders goals-empty-state when there are no active goals', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByTestId('goals-empty-state')).toBeInTheDocument();
  });

  it('shows an illustration inside the goals empty state region', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    const emptyState = screen.getByTestId('goals-empty-state');
    expect(within(emptyState).getByTestId('goals-empty-illustration')).toBeInTheDocument();
  });

  it('keeps existing "No goals yet" copy inside the empty state region', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    const emptyState = screen.getByTestId('goals-empty-state');
    expect(within(emptyState).getByText(/no goals yet/i)).toBeInTheDocument();
    expect(
      within(emptyState).getByText(/set a monthly or quarterly target/i),
    ).toBeInTheDocument();
  });

  it('keeps "+ New Goal" CTA visible in the illustrated empty state', () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByTestId('goals-empty-state')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ new goal/i })).toBeVisible();
  });

  it('renders illustrated empty state when only achieved goals exist (no active)', () => {
    const engine = makeEngine({
      goals: [GOAL_ACHIEVED],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    const emptyState = screen.getByTestId('goals-empty-state');
    expect(within(emptyState).getByTestId('goals-empty-illustration')).toBeInTheDocument();
    expect(within(emptyState).getByText(/no goals yet/i)).toBeInTheDocument();
  });

  it('does not render goals-empty-state when active goals exist', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByTestId('goals-empty-state')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 18. "+ New Goal" CTA opens form
// ---------------------------------------------------------------------------

describe('GoalsScreen — "+ New Goal" CTA', () => {
  it('renders the "+ New Goal" CTA button', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /\+ new goal/i })).toBeInTheDocument();
  });

  it('opens the form/dialog when "+ New Goal" is clicked', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    // Form or dialog should now be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 19–25. Form fields
// ---------------------------------------------------------------------------

describe('GoalsScreen — New Goal form fields', () => {
  async function openForm(engine: typeof mockEngine) {
    const user = userEvent.setup();
    renderWithProviders(<GoalsScreen engine={engine} />);
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));
    return user;
  }

  it('form has a title text input (required)', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toBeRequired();
  });

  it('form has a target date input (required)', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    // date input — query by label text or by type
    const dateInput = screen.getByLabelText(/target date/i);
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toBeRequired();
  });

  it('form has a timeframe selector for monthly / quarterly', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    // Timeframe can be a radio group or a select; check both options exist
    const monthly = screen.getByRole('radio', { name: /monthly/i }) ??
      screen.getByRole('option', { name: /monthly/i });
    const quarterly = screen.getByRole('radio', { name: /quarterly/i }) ??
      screen.getByRole('option', { name: /quarterly/i });

    expect(monthly).toBeInTheDocument();
    expect(quarterly).toBeInTheDocument();
  });

  it('form has an optional activity class picker', async () => {
    const engine = makeEngine({
      goals: [],
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
    });
    await openForm(engine);

    // Some control for selecting a class should exist
    // It may be a combobox, listbox, or set of buttons
    const classControl =
      screen.queryByRole('combobox', { name: /class/i }) ??
      screen.queryByRole('listbox', { name: /class/i }) ??
      screen.queryByLabelText(/activity class/i);

    expect(classControl).toBeInTheDocument();
  });

  it('form has an optional numeric target input', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    const targetInput = screen.queryByRole('spinbutton', { name: /target/i }) ??
      screen.queryByLabelText(/progress target/i);

    expect(targetInput).toBeInTheDocument();
  });

  it('form has a progress unit input linked to numeric target', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    const unitInput =
      screen.queryByRole('combobox', { name: /unit/i }) ??
      screen.queryByLabelText(/unit/i);

    expect(unitInput).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 24–25. Form submit disabled/enabled guard
// ---------------------------------------------------------------------------

describe('GoalsScreen — form submit guard', () => {
  async function openForm(engine: typeof mockEngine) {
    const user = userEvent.setup();
    renderWithProviders(<GoalsScreen engine={engine} />);
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));
    return user;
  }

  it('submit button is disabled when title and date are empty', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    await openForm(engine);

    const submit = screen.getByRole('button', { name: /save|create|add goal/i });
    expect(submit).toBeDisabled();
  });

  it('submit button is disabled when title is filled but date is empty', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    const user = await openForm(engine);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My Goal');

    const submit = screen.getByRole('button', { name: /save|create|add goal/i });
    expect(submit).toBeDisabled();
  });

  it('submit button is enabled once title and target date are provided', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    const user = await openForm(engine);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My Goal');

    const dateInput = screen.getByLabelText(/target date/i);
    await user.type(dateInput, '2026-06-30');

    const submit = screen.getByRole('button', { name: /save|create|add goal/i });
    expect(submit).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 26–30. Form submission behaviour
// ---------------------------------------------------------------------------

describe('GoalsScreen — form submission', () => {
  async function openForm(engine: typeof mockEngine) {
    const user = userEvent.setup();
    renderWithProviders(<GoalsScreen engine={engine} />);
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));
    return user;
  }

  it('calls engine.createGoal with a correct GoalDraft on submit', async () => {
    const createGoal = vi.fn();
    const engine = makeEngine({
      goals: [],
      activityClasses: [CLASS_RUNNING],
      createGoal,
    });
    const user = await openForm(engine);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'New monthly goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');

    // Confirm monthly timeframe is selected (should be default)
    const monthlyOption =
      screen.queryByRole('radio', { name: /monthly/i });
    if (monthlyOption) {
      // Radio: click monthly
      await user.click(monthlyOption);
    }

    await user.click(screen.getByRole('button', { name: /save|create|add goal/i }));

    expect(createGoal).toHaveBeenCalledTimes(1);
    const draft = createGoal.mock.calls[0]![0] as GoalDraft;
    expect(draft.title).toBe('New monthly goal');
    expect(draft.targetDate).toBe('2026-06-30');
    expect(draft.timeframe).toBe('monthly');
    expect(draft.status).toBe('active');
  });

  it('closes the form/dialog after a successful submit', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    const user = await openForm(engine);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');
    await user.click(screen.getByRole('button', { name: /save|create|add goal/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('new goal appears in the correct group after create (monthly)', async () => {
    // Simulate optimistic or immediate render: the goal list is updated by
    // the engine after invalidation; we test that the screen correctly groups
    // a freshly provided goal in "This month" after re-render.
    const engine = makeEngine({
      goals: [],
      activityClasses: [],
    });

    const { rerender } = renderWithProviders(<GoalsScreen engine={engine} />);

    // After create, the engine would provide the new goal via query invalidation
    const updatedEngine = makeEngine({
      goals: [GOAL_MONTHLY_QUALITATIVE],
      activityClasses: [],
    });

    rerender(<GoalsScreen engine={updatedEngine} />);

    expect(screen.getByText(/this month/i)).toBeInTheDocument();
    expect(screen.getByText(GOAL_MONTHLY_QUALITATIVE.title)).toBeInTheDocument();
  });

  it('form resets on re-open after a submit', async () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });
    const user = await openForm(engine);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Temp goal');
    await user.type(screen.getByLabelText(/target date/i), '2026-06-30');
    await user.click(screen.getByRole('button', { name: /save|create|add goal/i }));

    // Re-open
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    // Title should be reset
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
  });

  it('goal with no class selected → no class chip on the resulting card', () => {
    // Test the rendering path: GOAL_QUARTERLY_NO_CLASS has no activityClassId
    const engine = makeEngine({
      goals: [GOAL_QUARTERLY_NO_CLASS],
      activityClasses: [CLASS_RUNNING, CLASS_STRENGTH],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // The card for GOAL_QUARTERLY_NO_CLASS should not render any class name chip
    expect(screen.queryByText(CLASS_RUNNING.name)).not.toBeInTheDocument();
    expect(screen.queryByText(CLASS_STRENGTH.name)).not.toBeInTheDocument();
  });

  it('goal with numeric progressTarget and no unit renders without error', () => {
    const goalNoUnit: Omit<Goal, 'userId'> = {
      ...GOAL_MONTHLY_NUMERIC,
      id: 'goal-no-unit',
      progressUnit: undefined,
    };

    const engine = makeEngine({
      goals: [goalNoUnit],
      activityClasses: [],
    });

    // Should not throw; progress display degrades gracefully
    expect(() => {
      renderWithProviders(<GoalsScreen engine={engine} />);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('GoalsScreen — edge cases', () => {
  it('handles an empty goals list without crashing', () => {
    const engine = makeEngine({ goals: [], activityClasses: [] });

    expect(() => {
      renderWithProviders(<GoalsScreen engine={engine} />);
    }).not.toThrow();
  });

  it('handles only active goals (no achieved) without rendering the Achieved toggle', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.queryByRole('button', { name: /achieved/i })).not.toBeInTheDocument();
  });

  it('handles only achieved goals (no active) — shows empty state + Achieved toggle', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_ACHIEVED],
      activityClasses: [],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // Empty state because no active goals
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();

    // Achieved toggle present (there are achieved goals to show)
    const achievedToggle = screen.getByRole('button', { name: /achieved/i });
    expect(achievedToggle).toBeInTheDocument();

    // Expand and verify achieved goal is visible
    await user.click(achievedToggle);
    expect(screen.getByText(GOAL_ACHIEVED.title)).toBeInTheDocument();
  });

  it('multiple goals can be archived independently', async () => {
    const user = userEvent.setup();
    const archiveGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_MONTHLY_QUALITATIVE],
      activityClasses: [CLASS_RUNNING],
      archiveGoal,
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // There should be 2 Archive buttons initially
    const archiveButtons = screen.getAllByRole('button', { name: /archive/i });
    expect(archiveButtons).toHaveLength(2);

    // Archive the first goal: click Archive then Confirm
    await user.click(archiveButtons[0]!);
    expect(archiveGoal).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(archiveGoal).toHaveBeenCalledTimes(1);

    // Archive the second goal: click its Archive button then Confirm
    // Both Archive buttons are visible again after the first confirmation resolves
    const archiveButtons2 = screen.getAllByRole('button', { name: /archive/i });
    await user.click(archiveButtons2[0]!);
    expect(archiveGoal).toHaveBeenCalledTimes(1); // still 1 until Confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(archiveGoal).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// F2.5 Bug 3 — Archive goal UX: confirmation step + paused section + Restore
// ---------------------------------------------------------------------------

// Shared fixture: a paused goal (status === 'paused')
const GOAL_PAUSED: Omit<Goal, 'userId'> = {
  id: 'goal-paused-1',
  title: 'Paused running goal',
  targetDate: '2026-05-31',
  timeframe: 'monthly',
  status: 'paused',
  createdAt: '2026-05-01T00:00:00Z',
};

describe('GoalsScreen — Bug 3a: Archive requires confirmation before calling archiveGoal', () => {
  it('does NOT immediately call archiveGoal when Archive is clicked (confirmation required first)', async () => {
    const user = userEvent.setup();
    const archiveGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
      archiveGoal,
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /archive/i }));

    // archiveGoal must NOT have been called yet — a confirmation UI must appear first
    expect(archiveGoal).not.toHaveBeenCalled();
  });

  it('shows a confirmation UI element after clicking Archive (before archiveGoal is called)', async () => {
    const user = userEvent.setup();
    const archiveGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
      archiveGoal,
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /archive/i }));

    // A confirmation button/text must appear (e.g. "Confirm", "Yes", or similar)
    const confirmElement =
      screen.queryByRole('button', { name: /confirm/i }) ??
      screen.queryByRole('button', { name: /yes/i }) ??
      screen.queryByText(/are you sure/i) ??
      screen.queryByText(/confirm archive/i);

    expect(confirmElement).not.toBeNull();
  });
});

describe('GoalsScreen — Bug 3b: Paused goals appear in a "Paused" / "Archived" section', () => {
  it('renders a "Paused" or "Archived" section when a goal has status "paused"', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_PAUSED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // A "Paused" or "Archived" section heading must appear
    const pausedSection =
      screen.queryByText(/paused/i) ??
      screen.queryByText(/archived/i);

    expect(pausedSection).not.toBeNull();
  });

  it('renders the paused goal title inside the Paused/Archived section', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_PAUSED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByText(GOAL_PAUSED.title)).toBeInTheDocument();
  });

  it('renders a "Restore" button for each paused goal', () => {
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_PAUSED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
  });

  it('does NOT show the paused goal in the active "This month" section', () => {
    const engine = makeEngine({
      goals: [GOAL_PAUSED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    // The paused goal must not appear as an active goal in "This month"
    expect(screen.queryByText(/this month/i)).not.toBeInTheDocument();
  });
});

describe('GoalsScreen — Bug 3c: Restore button calls engine.updateGoal with status active', () => {
  it('clicking Restore calls engine.updateGoal with the goal id and { status: "active" }', async () => {
    const user = userEvent.setup();
    const updateGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_PAUSED],
      activityClasses: [],
      updateGoal,
    });

    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /restore/i }));

    expect(updateGoal).toHaveBeenCalledTimes(1);
    expect(updateGoal).toHaveBeenCalledWith(GOAL_PAUSED.id, { status: 'active' });
  });
});

// ---------------------------------------------------------------------------
// F8.3 — onEditGoal prop + Edit button wiring
// ---------------------------------------------------------------------------

describe('GoalsScreen — F8.3: onEditGoal prop wiring', () => {
  it('clicking an active goal\'s Edit button calls onEditGoal with that goal object', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEditGoal).toHaveBeenCalledTimes(1);
    expect(onEditGoal).toHaveBeenCalledWith(GOAL_MONTHLY_NUMERIC);
  });

  it('clicking Edit on a quarterly goal calls onEditGoal with that quarterly goal object', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_QUARTERLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(onEditGoal).toHaveBeenCalledTimes(1);
    expect(onEditGoal).toHaveBeenCalledWith(GOAL_QUARTERLY_NUMERIC);
  });

  it('each active goal card has its own Edit button that calls onEditGoal with the correct goal', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_MONTHLY_QUALITATIVE],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons).toHaveLength(2);

    // Click the second edit button (GOAL_MONTHLY_QUALITATIVE)
    await user.click(editButtons[1]!);

    expect(onEditGoal).toHaveBeenCalledTimes(1);
    expect(onEditGoal).toHaveBeenCalledWith(GOAL_MONTHLY_QUALITATIVE);
  });
});

describe('GoalsScreen — F8.3: onNewGoal prop overrides inline form', () => {
  it('when onNewGoal is provided, clicking "+ New Goal" calls onNewGoal and does NOT open the inline sheet', async () => {
    const user = userEvent.setup();
    const onNewGoal = vi.fn();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    expect(onNewGoal).toHaveBeenCalledTimes(1);
    // The inline NewGoalForm dialog must NOT appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('when onNewGoal is NOT provided, clicking "+ New Goal" opens the inline NewGoalForm (backward compat)', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
    });

    // No onNewGoal or onEditGoal passed — backward-compat mode
    renderWithProviders(<GoalsScreen engine={engine} />);

    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    // The inline dialog must appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('GoalsScreen — F8.3: achieved goals do NOT have an Edit button', () => {
  it('achieved goals rendered in the expanded Achieved section have no Edit button', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_ACHIEVED],
      activityClasses: [],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    // Expand the Achieved section
    await user.click(screen.getByRole('button', { name: /achieved/i }));

    // The achieved goal card must not have an Edit button
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('active goals have Edit buttons but achieved goals in the same render do not', async () => {
    const user = userEvent.setup();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC, GOAL_ACHIEVED],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    // One Edit button for the active goal
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(1);

    // Expand achieved section
    await user.click(screen.getByRole('button', { name: /achieved/i }));

    // Still only one Edit button (the achieved card must not add another)
    expect(screen.getAllByRole('button', { name: /edit/i })).toHaveLength(1);
  });
});

describe('GoalsScreen — F8.3: archive/restore regression', () => {
  it('archive+restore behaviour is unaffected when onEditGoal is also provided', async () => {
    const user = userEvent.setup();
    const archiveGoal = vi.fn();
    const onEditGoal = vi.fn<(goal: Omit<Goal, 'userId'>) => void>();
    const onNewGoal = vi.fn();
    const engine = makeEngine({
      goals: [GOAL_MONTHLY_NUMERIC],
      activityClasses: [CLASS_RUNNING],
      archiveGoal,
    });

    renderWithProviders(
      <GoalsScreen engine={engine} onNewGoal={onNewGoal} onEditGoal={onEditGoal} />,
    );

    // Initiate archive (should require confirmation)
    await user.click(screen.getByRole('button', { name: /archive/i }));
    expect(archiveGoal).not.toHaveBeenCalled();

    // Confirm archive
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(archiveGoal).toHaveBeenCalledTimes(1);
    expect(archiveGoal).toHaveBeenCalledWith(GOAL_MONTHLY_NUMERIC.id);
  });
});
