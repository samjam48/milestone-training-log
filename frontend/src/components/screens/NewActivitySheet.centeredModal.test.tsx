/**
 * P25.4 — New activity: centered modal
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: NewActivitySheet must use CenteredModal (not bottom sheet).
 * Production code not migrated yet.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  CENTERED_MODAL_PANEL_TEST_ID,
  expectCenteredModalDialog,
  expectCenteredModalScrim,
  findCenteredModalPanel,
  findCenteredModalScrim,
  findDragHandle,
  isBottomSheetLayout,
} from '../../test/centeredModalLayout';
import type { ActivityClass } from '../../types';
import { NewActivitySheet } from './NewActivitySheet';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CLASS_STRENGTH: ActivityClass = {
  id: 'cls-strength',
  userId: 'user-1',
  name: 'Strength',
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

function baseProps(overrides: Partial<Parameters<typeof NewActivitySheet>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    activityClasses: [CLASS_STRENGTH, CLASS_MOBILITY],
    onCreate: vi.fn(),
    ...overrides,
  };
}

function renderOpenSheet(
  overrides: Partial<Parameters<typeof NewActivitySheet>[0]> = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(<NewActivitySheet {...baseProps(overrides)} />);
}

function getCreateDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /create new activity/i });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// P25.4 — CenteredModal layout contract
// ---------------------------------------------------------------------------

describe('NewActivitySheet — P25.4 centered modal', () => {
  it('renders the create dialog with centered-modal-panel test id', () => {
    renderOpenSheet();

    expectCenteredModalDialog(getCreateDialog());
  });

  it('does not use bottom-0 inset-x-0 sheet layout', () => {
    renderOpenSheet();

    const dialog = getCreateDialog();
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(isBottomSheetLayout(panel.className)).toBe(false);
    expect(panel.className).not.toMatch(/\brounded-t-2xl\b/);
  });

  it('does not render a bottom-sheet drag handle', () => {
    renderOpenSheet();

    expect(findDragHandle(getCreateDialog())).toBeNull();
  });

  it('renders a scrim behind the centered modal', () => {
    renderOpenSheet();

    expectCenteredModalScrim();
  });

  it('closes via scrim click using the centered-modal scrim', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderOpenSheet({ onClose });

    const scrim = findCenteredModalScrim();
    expect(scrim).not.toBeNull();
    await user.click(scrim as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the dialog panel with data-testid centered-modal-panel', () => {
    renderOpenSheet();

    expect(screen.getByTestId(CENTERED_MODAL_PANEL_TEST_ID)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// P25.4 — X close + Create at bottom (no Cancel row)
// ---------------------------------------------------------------------------

describe('NewActivitySheet — P25.4 X close and Create at bottom', () => {
  it('retains X close control that dismisses without creating', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreate = vi.fn();

    renderOpenSheet({ onClose, onCreate });

    await user.type(screen.getByRole('textbox', { name: /activity name/i }), 'Test');
    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('retains Create submit at the bottom of the form', () => {
    renderOpenSheet();

    const dialog = getCreateDialog();
    const createButton = within(dialog).getByRole('button', { name: /^create$/i });
    const panel = findCenteredModalPanel(dialog) ?? dialog;

    expect(panel.contains(createButton)).toBe(true);
    expect(createButton).toHaveAttribute('type', 'submit');
    expect(createButton.className).toMatch(/\bw-full\b/);
  });

  it('does not render a Cancel button (X handles dismiss)', () => {
    renderOpenSheet();

    const dialog = getCreateDialog();

    expect(
      within(dialog).queryByRole('button', { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });
});
