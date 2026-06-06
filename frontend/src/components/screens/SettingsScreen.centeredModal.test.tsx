/**
 * P25.2 — Centered modal pattern (Settings class flows)
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: class create/edit/delete modals must use a shared
 * centered modal (not bottom sheets). Production code not written yet.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine } from '../../test/mockEngine';
import {
  CENTERED_MODAL_PANEL_TEST_ID,
  expectCenteredModalDialog,
  expectCenteredModalScrim,
  findCenteredModalPanel,
  findDragHandle,
  isBottomSheetLayout,
} from '../../test/centeredModalLayout';
import type { Activity, ActivityClass, TrainingBlock } from '../../types';
import { SettingsScreen } from './SettingsScreen';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
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

const ACTIVITY_INACTIVE: Activity = {
  id: 'act-inactive-1',
  userId: 'user-1',
  activityClassId: 'cls-running',
  name: 'Inactive Activity',
  type: 'performance',
  isActive: false,
  createdAt: '2026-01-01T00:00:00Z',
};

function makeEngine(
  overrides: Partial<typeof mockEngine> = {},
): typeof mockEngine {
  return { ...mockEngine, ...overrides };
}

function renderSettings(
  overrides: Partial<typeof mockEngine> = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <SettingsScreen
      engine={makeEngine({
        block: ACTIVE_BLOCK,
        activityClasses: [CLASS_RUNNING],
        activities: [ACTIVITY_RUNNING],
        logs: [],
        ...overrides,
      })}
    />,
  );
}

async function openNewClassDialog(): Promise<HTMLElement> {
  const user = userEvent.setup();
  renderSettings({ activityClasses: [] });
  await user.click(screen.getByRole('button', { name: /\+ new class/i }));
  return screen.getByRole('dialog', { name: /new activity class/i });
}

async function openEditClassDialog(): Promise<HTMLElement> {
  const user = userEvent.setup();
  renderSettings();
  await user.click(screen.getByRole('button', { name: /edit running/i }));
  return screen.getByRole('dialog', { name: /edit activity class/i });
}

async function openDeleteClassDialog(): Promise<HTMLElement> {
  const user = userEvent.setup();
  renderSettings({
    activities: [ACTIVITY_RUNNING, ACTIVITY_INACTIVE],
  });
  await user.click(screen.getByRole('button', { name: /delete running/i }));
  return screen.getByRole('dialog', { name: /delete activity class/i });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// NewActivityClassForm — centered modal
// ---------------------------------------------------------------------------

describe('SettingsScreen — P25.2 NewActivityClassForm centered modal', () => {
  it('renders the new-class dialog with centered-modal-panel test id', async () => {
    const dialog = await openNewClassDialog();

    expectCenteredModalDialog(dialog);
  });

  it('does not use bottom-0 inset-x-0 sheet layout for new class', async () => {
    const dialog = await openNewClassDialog();
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(isBottomSheetLayout(panel.className)).toBe(false);
    expect(panel.className).not.toMatch(/\brounded-t-2xl\b/);
  });

  it('does not render a bottom-sheet drag handle in new class dialog', async () => {
    const dialog = await openNewClassDialog();

    expect(findDragHandle(dialog)).toBeNull();
  });

  it('renders a scrim behind the new-class centered modal', async () => {
    await openNewClassDialog();

    expectCenteredModalScrim();
  });

  it('retains X close control on new class dialog', async () => {
    const user = userEvent.setup();
    await openNewClassDialog();

    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(
      screen.queryByRole('dialog', { name: /new activity class/i }),
    ).not.toBeInTheDocument();
  });

  it('retains Create class submit at the bottom of new class form', async () => {
    await openNewClassDialog();

    const dialog = screen.getByRole('dialog', { name: /new activity class/i });
    const createButton = within(dialog).getByRole('button', { name: /create class/i });
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(panel.contains(createButton)).toBe(true);
    expect(createButton).toHaveAttribute('type', 'submit');
  });
});

// ---------------------------------------------------------------------------
// EditActivityClassForm — centered modal
// ---------------------------------------------------------------------------

describe('SettingsScreen — P25.2 EditActivityClassForm centered modal', () => {
  it('renders the edit-class dialog with centered-modal-panel test id', async () => {
    const dialog = await openEditClassDialog();

    expectCenteredModalDialog(dialog);
  });

  it('does not use bottom-0 sheet layout for edit class', async () => {
    const dialog = await openEditClassDialog();
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(isBottomSheetLayout(panel.className)).toBe(false);
  });

  it('does not render a drag handle in edit class dialog', async () => {
    const dialog = await openEditClassDialog();

    expect(findDragHandle(dialog)).toBeNull();
  });

  it('retains X close control on edit class dialog', async () => {
    const user = userEvent.setup();
    await openEditClassDialog();

    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(
      screen.queryByRole('dialog', { name: /edit activity class/i }),
    ).not.toBeInTheDocument();
  });

  it('retains Save submit at the bottom of edit class form', async () => {
    await openEditClassDialog();

    const dialog = screen.getByRole('dialog', { name: /edit activity class/i });
    const saveButton = within(dialog).getByRole('button', { name: /^save$/i });
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(panel.contains(saveButton)).toBe(true);
    expect(saveButton).toHaveAttribute('type', 'submit');
  });
});

// ---------------------------------------------------------------------------
// DeleteActivityClassDialog — centered modal + two-step delete
// ---------------------------------------------------------------------------

describe('SettingsScreen — P25.2 DeleteActivityClassDialog centered modal', () => {
  it('renders delete-class dialog with centered-modal-panel test id', async () => {
    const dialog = await openDeleteClassDialog();

    expectCenteredModalDialog(dialog);
  });

  it('does not use bottom-0 sheet layout for delete class', async () => {
    const dialog = await openDeleteClassDialog();
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(isBottomSheetLayout(panel.className)).toBe(false);
  });

  it('does not render a drag handle in delete class dialog', async () => {
    const dialog = await openDeleteClassDialog();

    expect(findDragHandle(dialog)).toBeNull();
  });

  it('retains two-step delete: step one confirm before listing activities', async () => {
    const user = userEvent.setup();
    await openDeleteClassDialog();

    expect(screen.getByText(/delete class\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/will be deleted/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^delete class$/i }));

    const dialog = screen.getByRole('dialog', { name: /delete activity class/i });
    expect(within(dialog).getByText(ACTIVITY_RUNNING.name)).toBeInTheDocument();
    expect(within(dialog).getByText(ACTIVITY_INACTIVE.name)).toBeInTheDocument();
    expect(within(dialog).getByText(/will be deleted/i)).toBeInTheDocument();
  });

  it('exposes dialog a11y attributes on delete class modal', async () => {
    const dialog = await openDeleteClassDialog();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Delete activity class');
  });
});

// ---------------------------------------------------------------------------
// Shared pattern — all class flows use centered modal contract
// ---------------------------------------------------------------------------

describe('SettingsScreen — P25.2 shared centered modal contract', () => {
  it('marks dialog panels with data-testid centered-modal-panel across class flows', async () => {
    const user = userEvent.setup();

    renderSettings({
      activityClasses: [CLASS_RUNNING],
      activities: [ACTIVITY_RUNNING],
    });

    await user.click(screen.getByRole('button', { name: /\+ new class/i }));
    expect(screen.getByTestId(CENTERED_MODAL_PANEL_TEST_ID)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    await user.click(screen.getByRole('button', { name: /edit running/i }));
    expect(screen.getByTestId(CENTERED_MODAL_PANEL_TEST_ID)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    await user.click(screen.getByRole('button', { name: /delete running/i }));
    expect(screen.getByTestId(CENTERED_MODAL_PANEL_TEST_ID)).toBeInTheDocument();
  });
});
