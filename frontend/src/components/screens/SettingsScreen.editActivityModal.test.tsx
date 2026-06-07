/**
 * P25.3 — Edit activity as centered modal
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: Settings → Edit activity must open an in-place centered
 * modal (not ActivityManagerScreen stack). Production code not written yet.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine } from '../../test/mockEngine';
import {
  expectCenteredModalDialog,
  findCenteredModalPanel,
} from '../../test/centeredModalLayout';
import type { Activity, ActivityClass, TrainingBlock } from '../../types';
import type { MilestoneEngineResult, NewActivityDraft } from '../../hooks/useMilestoneEngine';
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

const CLASS_MOBILITY: ActivityClass = {
  id: 'cls-mobility',
  userId: 'user-1',
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
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

function makeEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  const updateActivity = vi.fn<
    (activityId: string, patch: Partial<NewActivityDraft>) => void
  >();

  return {
    ...mockEngine,
    block: ACTIVE_BLOCK,
    activityClasses: [CLASS_RUNNING, CLASS_MOBILITY],
    activities: [ACTIVITY_RUNNING],
    logs: [],
    updateActivity,
    ...overrides,
  };
}

function renderSettings(
  engineOverrides: Partial<MilestoneEngineResult> = {},
): { engine: MilestoneEngineResult } {
  const engine = makeEngine(engineOverrides);
  renderWithProviders(<SettingsScreen engine={engine} />);
  return { engine };
}

async function openEditActivityModal(): Promise<HTMLElement> {
  const user = userEvent.setup();
  renderSettings();
  await user.click(screen.getByRole('button', { name: /edit morning run/i }));
  return screen.getByRole('dialog', { name: /edit activity/i });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// P25.3 — centered modal entry (not stack / onEditActivity delegate)
// ---------------------------------------------------------------------------

describe('SettingsScreen — P25.3 Edit activity centered modal', () => {
  it('opens a centered modal when Edit is clicked on an activity row', async () => {
    const dialog = await openEditActivityModal();

    expectCenteredModalDialog(dialog);
  });

  it('opens the modal in-place without delegating to onEditActivity', async () => {
    const user = userEvent.setup();
    const onEditActivity = vi.fn();
    const engine = makeEngine();

    renderWithProviders(
      <SettingsScreen engine={engine} onEditActivity={onEditActivity} />,
    );

    await user.click(screen.getByRole('button', { name: /edit morning run/i }));

    expect(onEditActivity).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: /edit activity/i }),
    ).toBeInTheDocument();
  });

  it('prefills name, class, type, and default volume unit from the activity', async () => {
    await openEditActivityModal();

    const dialog = screen.getByRole('dialog', { name: /edit activity/i });

    expect(within(dialog).getByLabelText(/activity name/i)).toHaveValue('Morning Run');
    expect(within(dialog).getByRole('button', { name: /running/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(dialog).getByRole('radio', { name: /performance/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(dialog).getByRole('button', { name: 'km' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('retains X close control that dismisses the modal without saving', async () => {
    const user = userEvent.setup();
    const { engine } = renderSettings();

    await user.click(screen.getByRole('button', { name: /edit morning run/i }));
    expect(
      screen.getByRole('dialog', { name: /edit activity/i }),
    ).toBeInTheDocument();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^close$/i }));

    expect(
      screen.queryByRole('dialog', { name: /edit activity/i }),
    ).not.toBeInTheDocument();
    expect(engine.updateActivity).not.toHaveBeenCalled();
  });

  it('retains Save submit at the bottom of the edit activity form', async () => {
    await openEditActivityModal();

    const dialog = screen.getByRole('dialog', { name: /edit activity/i });
    const saveButton = within(dialog).getByRole('button', { name: /^save$/i });
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(panel.contains(saveButton)).toBe(true);
    expect(saveButton).toHaveAttribute('type', 'submit');
  });

  it('does not render a Deactivate control in the edit activity modal', async () => {
    await openEditActivityModal();

    const dialog = screen.getByRole('dialog', { name: /edit activity/i });

    expect(
      within(dialog).queryByRole('button', { name: /deactivate/i }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/deactivate activity/i)).not.toBeInTheDocument();
  });

  it('calls engine.updateActivity with the production PATCH shape on Save', async () => {
    const user = userEvent.setup();
    const { engine } = renderSettings();

    await user.click(screen.getByRole('button', { name: /edit morning run/i }));

    const dialog = screen.getByRole('dialog', { name: /edit activity/i });
    const nameInput = within(dialog).getByLabelText(/activity name/i);

    await user.clear(nameInput);
    await user.type(nameInput, 'Evening Run');
    await user.click(within(dialog).getByRole('button', { name: /mobility/i }));
    await user.click(within(dialog).getByRole('radio', { name: /recovery/i }));
    await user.click(within(dialog).getByRole('button', { name: 'minutes' }));
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

    expect(engine.updateActivity).toHaveBeenCalledTimes(1);
    expect(engine.updateActivity).toHaveBeenCalledWith(ACTIVITY_RUNNING.id, {
      name: 'Evening Run',
      activityClassId: CLASS_MOBILITY.id,
      type: 'recovery',
      defaultVolumeUnit: 'minutes',
    });
    expect(
      screen.queryByRole('dialog', { name: /edit activity/i }),
    ).not.toBeInTheDocument();
  });
});
