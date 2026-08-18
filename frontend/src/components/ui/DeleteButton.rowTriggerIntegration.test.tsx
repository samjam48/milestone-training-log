/**
 * DeleteButton call-site integration tests
 *
 * For each of the four row-trigger call sites:
 *   1. The row delete control is a button with a descriptive aria-label
 *      (not raw text "Delete")
 *   2. The existing confirmation flow still fires unchanged after clicking
 *      the row trigger
 *
 * Screens under test:
 *   A. LogHistoryScreen  — window.confirm gate
 *   B. SettingsScreen    — modal dialog (DeleteActivityClassDialog)
 *   C. EditBlockRulesScreen — direct deleteRule call (no confirmation step)
 *   D. GoalsScreen       — inline confirm state pattern (confirmingDelete)
 *
 * These tests describe expected behavior (the text "Delete"
 * row triggers are replaced with <DeleteButton> instances).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type {
  Activity,
  ActivityClass,
  ActivityLog,
  Rule,
  TrainingBlock,
  WeeklyTarget,
} from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { LogHistoryScreen } from '../screens/LogHistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EditBlockRulesScreen } from '../screens/EditBlockRulesScreen';
import { GoalsScreen } from '../screens/GoalsScreen';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_WALK: ActivityClass = {
  id: 'cls-walk',
  userId: 'user-1',
  name: 'Gentle walk',
  type: 'performance',
  defaultRecoveryWindowDays: 1,
  loadWeight: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_RUN: Activity = {
  id: 'act-run',
  userId: 'user-1',
  activityClassId: CLASS_RUNNING.id,
  name: 'Morning run',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const LOG_ENTRY: ActivityLog = {
  id: 'log-1',
  userId: 'user-1',
  activityId: ACTIVITY_RUN.id,
  loggedDate: '2026-06-10',
  durationMinutes: 30,
  postActivityFeel: 'fine',
  rpe: 6,
  volumeValue: 5,
  volumeUnit: 'km',
  ruleViolationsAtLog: [],
  createdAt: '2026-06-10T07:00:00Z',
};

const RULE_REST: Rule = {
  id: 'rule-rest',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const WEEKLY_TARGET: WeeklyTarget = {
  id: 'wt-run',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  targetValue: 3,
  targetUnit: 'sessions',
  createdAt: '2026-06-01T00:00:00Z',
};

function makeEngine(overrides: Partial<MilestoneEngineResult> = {}): MilestoneEngineResult {
  return { ...mockEngine, ...overrides };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// A. LogHistoryScreen — log row delete trigger
// ---------------------------------------------------------------------------

describe('LogHistoryScreen: log row delete trigger', () => {
  function renderLogHistory(onDeleteLog = vi.fn()) {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activities: [ACTIVITY_RUN],
      logs: [LOG_ENTRY],
    });
    return renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
        onDeleteLog={onDeleteLog}
      />,
    );
  }

  it('row delete trigger is a button with a descriptive aria-label (not text "Delete")', () => {
    renderLogHistory();
    // Must not find a raw visible text "Delete" as the row trigger
    // (confirmation dialog text is allowed, but not a standalone text button)
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    // The label must be descriptive — not just "Delete"
    const label = deleteButtons[0]!.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('Delete');
    expect(label.toLowerCase()).toContain('delete');
  });

  it('does NOT render a bare text-only "Delete" row trigger button', () => {
    renderLogHistory();
    // A button whose accessible name is exactly "Delete" (plain text label)
    // must not exist as the row trigger — it should be an icon button with
    // a descriptive label like "Delete activity log".
    const bareDeleteBtn = screen.queryByRole('button', { name: 'Delete' });
    expect(bareDeleteBtn).not.toBeInTheDocument();
  });

  it('clicking the delete icon triggers window.confirm', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLogHistory();

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteLog after window.confirm returns true', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleteLog = vi.fn();
    renderLogHistory(onDeleteLog);

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    expect(onDeleteLog).toHaveBeenCalledWith(LOG_ENTRY.id);
  });

  it('does NOT call onDeleteLog when window.confirm returns false', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onDeleteLog = vi.fn();
    renderLogHistory(onDeleteLog);

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    expect(onDeleteLog).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B. SettingsScreen — activity class row delete trigger
// ---------------------------------------------------------------------------

describe('SettingsScreen: activity class row delete trigger', () => {
  function renderSettings() {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING, CLASS_WALK],
      activities: [],
    });
    return renderWithProviders(
      <SettingsScreen engine={engine} />,
    );
  }

  it('the class row delete control is a button with a descriptive aria-label', () => {
    renderSettings();
    // Each class row must have an icon-button delete trigger, not text "Delete"
    const classRowDeleteBtn = screen.queryByRole('button', {
      name: /delete running/i,
    });
    expect(classRowDeleteBtn).toBeInTheDocument();
  });

  it('does NOT render a bare text "Delete" label on the class row trigger', () => {
    renderSettings();
    // Previous behavior: SettingsScreen:1299 renders text "Delete" inside the button.
    // Expected behavior: it must be an icon button with aria-label "Delete Running" etc.
    // This test verifies the text-content button is gone.
    // We check that no button whose ONLY accessible name (from text content) is
    // the literal word "Delete" appears as the row trigger.
    // Note: confirmation dialog buttons ("Delete class", "Delete anyway") are
    // intentionally excluded — they only appear after clicking the row trigger.
    const buttons = screen.getAllByRole('button');
    const plainDeleteBtns = buttons.filter(
      (btn) => btn.textContent?.trim() === 'Delete',
    );
    expect(plainDeleteBtns).toHaveLength(0);
  });

  it('clicking the icon trigger opens the confirmation dialog', async () => {
    const user = userEvent.setup();
    renderSettings();

    const runningDeleteBtn = screen.getByRole('button', {
      name: /delete running/i,
    });
    await user.click(runningDeleteBtn);

    // The confirmation dialog should appear — the existing modal text
    expect(screen.getByText(/Delete class\?/i)).toBeInTheDocument();
  });

  it('confirmation dialog buttons stay as text (not converted to icons)', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /delete running/i }));

    // SettingsScreen:773 — "Delete class" confirm button must remain text
    expect(screen.getByRole('button', { name: /Delete class/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// C. EditBlockRulesScreen — rule row delete trigger
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen: rule row delete trigger', () => {
  function renderRules(deleteRule = vi.fn()) {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUN],
      rules: [RULE_REST],
      deleteRule,
    });
    return renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );
  }

  it('the rule row delete control is a button with a descriptive aria-label', () => {
    renderRules();
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    const label = deleteButtons[0]!.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('Delete');
    expect(label.toLowerCase()).toContain('delete');
  });

  it('does NOT render a bare text-content "Delete" button as the row trigger', () => {
    renderRules();
    // Previous behavior: EditBlockRulesScreen:205 renders text "Delete".
    // Expected behavior: must be an icon button with a descriptive aria-label.
    const buttons = screen.getAllByRole('button');
    const plainDeleteBtns = buttons.filter(
      (btn) => btn.textContent?.trim() === 'Delete',
    );
    expect(plainDeleteBtns).toHaveLength(0);
  });

  it('clicking the delete icon calls deleteRule with the rule id', async () => {
    const user = userEvent.setup();
    const deleteRule = vi.fn();
    renderRules(deleteRule);

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    expect(deleteRule).toHaveBeenCalledWith(RULE_REST.id);
  });
});

// ---------------------------------------------------------------------------
// D. GoalsScreen — weekly target row delete trigger (sets confirmingDelete)
// ---------------------------------------------------------------------------

describe('GoalsScreen: weekly target row delete trigger', () => {
  function renderGoals() {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUN],
      weeklyTargets: [WEEKLY_TARGET],
      weeklyProgress: [],
    });
    return renderWithProviders(
      <GoalsScreen engine={engine} />,
    );
  }

  it('the weekly target row delete trigger is a button with a descriptive aria-label', () => {
    renderGoals();
    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    const label = deleteButtons[0]!.getAttribute('aria-label') ?? '';
    expect(label).not.toBe('Delete');
    expect(label.toLowerCase()).toContain('delete');
  });

  it('does NOT render a bare text-content "Delete" button as the row trigger', () => {
    renderGoals();
    // Previous behavior: GoalsScreen:444 (inside WeeklyTargetCard) renders text "Delete"
    // for the row trigger. After the delete-control cleanup the row trigger becomes an icon button.
    // Note: once clicked, the inline-confirm "Confirm" button appears instead —
    // the confirm-state itself never said "Delete" (it says "Confirm"), so no
    // exclusion is needed here for the initial render.
    const buttons = screen.getAllByRole('button');
    const plainDeleteBtns = buttons.filter(
      (btn) => btn.textContent?.trim() === 'Delete',
    );
    expect(plainDeleteBtns).toHaveLength(0);
  });

  it('clicking the delete icon trigger transitions to inline-confirm state', async () => {
    const user = userEvent.setup();
    renderGoals();

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    // After clicking the row trigger, the inline-confirm UI must appear
    // (GoalsScreen inline-confirm pattern: "Confirm delete?" text + Confirm button)
    expect(screen.getByText(/Confirm delete\?/i)).toBeInTheDocument();
  });

  it('the inline "Confirm" button (not icon) appears in confirm state', async () => {
    const user = userEvent.setup();
    renderGoals();

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    // The confirm button in the inline flow must stay as text, not become an icon.
    // It is labelled "Confirm" (not "Delete"), so it is never converted.
    expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
  });

  it('the inline "Cancel" button is present in confirm state (not just icon)', async () => {
    const user = userEvent.setup();
    renderGoals();

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('clicking Cancel in confirm state restores the row trigger (not the confirm state)', async () => {
    const user = userEvent.setup();
    renderGoals();

    const deleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    await user.click(deleteButtons[0]!);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    // After cancel: confirm state UI must be gone
    expect(screen.queryByText(/Confirm delete\?/i)).not.toBeInTheDocument();
    // The row trigger must be back
    const restoreDeleteButtons = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('delete'),
    );
    expect(restoreDeleteButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: confirmation-dialog text buttons are NOT converted to icons
// ---------------------------------------------------------------------------

describe('confirmation-dialog buttons remain text (edge case guard)', () => {
  it('SettingsScreen:773 "Delete class" confirm button is a text button, not icon-only', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      activities: [],
    });
    renderWithProviders(<SettingsScreen engine={engine} />);

    // Open the delete dialog
    await user.click(screen.getByRole('button', { name: /delete running/i }));

    const confirmBtn = screen.getByRole('button', { name: /Delete class/i });
    // Must have visible text content (not just an SVG icon with hidden text)
    expect(confirmBtn.textContent?.trim()).toBeTruthy();
    expect(confirmBtn.textContent?.trim().toLowerCase()).toContain('delete');
  });
});
