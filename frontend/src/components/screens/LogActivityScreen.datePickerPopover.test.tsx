/**
 * P25.5 — Date picker: compact popover
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: LogActivityScreen create + edit must use a compact
 * popover anchored to the date field (not the bottom-sheet DatePickerModal).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  DATE_PICKER_FIELD_TEST_ID,
  DATE_PICKER_POPOVER_TEST_ID,
  expectCompactDatePickerPopover,
  expectDatePickerPopoverAssociated,
  findDatePickerField,
  findDatePickerPopover,
  findDatePickerScrim,
  findDragHandle,
  isDatePickerBottomSheet,
} from '../../test/datePickerPopoverLayout';
import {
  createLogActivityEngine,
  logActivityWalk,
} from '../../test/fixtures/c62Fixtures';
import { LogActivityScreen } from './LogActivityScreen';

const TODAY = '2026-05-28';
const YESTERDAY = '2026-05-27';
const TOMORROW = '2026-05-29';

function mockFieldRect(
  field: HTMLElement,
  rect: Partial<DOMRect>,
): void {
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

function mockViewport(height: number, width = 390): void {
  vi.spyOn(document.documentElement, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

async function openDatePickerForCreate(
  user: ReturnType<typeof userEvent.setup>,
): Promise<{ field: HTMLElement; popover: HTMLElement }> {
  const engine = createLogActivityEngine({ todayDate: TODAY });

  renderWithProviders(
    <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
  );

  await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
  const field = screen.getByTestId(DATE_PICKER_FIELD_TEST_ID);
  await user.click(field);

  const popover = findDatePickerPopover();
  expect(popover).not.toBeNull();

  return { field, popover: popover as HTMLElement };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// P25.5 — Popover association (create + edit)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — P25.5 date popover association', () => {
  it('associates the open popover with log-date-field via aria-controls (create)', async () => {
    const user = userEvent.setup();
    const { field, popover } = await openDatePickerForCreate(user);

    expectDatePickerPopoverAssociated(field, popover);
  });

  it('associates the open popover with log-date-field via aria-controls (edit)', async () => {
    const user = userEvent.setup();
    const existingLog = {
      id: 'log-edit-popover',
      userId: 'user-1',
      activityId: logActivityWalk.id,
      loggedDate: TODAY,
      durationMinutes: 25,
      volumeValue: 2,
      volumeUnit: 'km' as const,
      rpe: 4 as const,
      postActivityFeel: 'fine' as const,
      notes: 'Easy',
      createdAt: '2026-04-07T06:00:00Z',
    };

    renderWithProviders(
      <LogActivityScreen
        engine={createLogActivityEngine({ todayDate: TODAY, logs: [existingLog] })}
        logId={existingLog.id}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    const field = screen.getByTestId(DATE_PICKER_FIELD_TEST_ID);
    expect(field).toHaveAttribute('aria-expanded', 'false');

    await user.click(field);

    const popover = findDatePickerPopover();
    expect(popover).not.toBeNull();
    expectDatePickerPopoverAssociated(field, popover as HTMLElement);
  });

  it('toggles aria-expanded on the date field when the popover opens and closes', async () => {
    const user = userEvent.setup();
    const { field } = await openDatePickerForCreate(user);

    expect(field).toHaveAttribute('aria-expanded', 'true');

    await user.click(field);

    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(findDatePickerPopover()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// P25.5 — Compact popover width (not bottom sheet)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — P25.5 compact popover layout', () => {
  it('renders a content-sized popover instead of inset-x-0 bottom sheet layout', async () => {
    const user = userEvent.setup();
    const { popover } = await openDatePickerForCreate(user);

    expectCompactDatePickerPopover(popover);
  });

  it('does not render the legacy date-picker-modal bottom sheet test id', async () => {
    const user = userEvent.setup();
    await openDatePickerForCreate(user);

    expect(screen.queryByTestId('date-picker-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId(DATE_PICKER_POPOVER_TEST_ID)).toBeInTheDocument();
  });

  it('does not use a heavy full-viewport modal scrim (light scrim or none)', async () => {
    const user = userEvent.setup();
    await openDatePickerForCreate(user);

    const legacyScrim = document.querySelector('.fixed.inset-0.bg-black\\/60');
    expect(legacyScrim).toBeNull();

    const scrim = findDatePickerScrim();
    if (scrim !== null) {
      expect(scrim.className).not.toMatch(/bg-black\/60/);
    }
  });
});

// ---------------------------------------------------------------------------
// P25.5 — Placement: prefer below, flip above when clipped
// ---------------------------------------------------------------------------

describe('LogActivityScreen — P25.5 popover placement', () => {
  it('prefers placing the popover below the date field when there is room', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const field = screen.getByTestId(DATE_PICKER_FIELD_TEST_ID);
    mockViewport(844);
    mockFieldRect(field, {
      top: 220,
      bottom: 270,
      left: 16,
      right: 374,
      width: 358,
      height: 50,
      x: 16,
      y: 220,
    });

    await user.click(field);

    const popover = findDatePickerPopover();
    expect(popover).not.toBeNull();
    expect(popover).toHaveAttribute('data-placement', 'bottom');
  });

  it('flips the popover above the date field when below would clip', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const field = screen.getByTestId(DATE_PICKER_FIELD_TEST_ID);
    mockViewport(844);
    mockFieldRect(field, {
      top: 780,
      bottom: 830,
      left: 16,
      right: 374,
      width: 358,
      height: 50,
      x: 16,
      y: 780,
    });

    await user.click(field);

    const popover = findDatePickerPopover();
    expect(popover).not.toBeNull();
    expect(popover).toHaveAttribute('data-placement', 'top');
  });
});

// ---------------------------------------------------------------------------
// P25.5 — maxDate = today (future dates disabled)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — P25.5 future dates disabled in popover', () => {
  it('disables tomorrow in the popover when maxDate is today (create)', async () => {
    const user = userEvent.setup();
    await openDatePickerForCreate(user);

    const tomorrowButton = screen.getByTestId(`date-picker-day-${TOMORROW}`);
    expect(tomorrowButton).toBeDisabled();
    expect(tomorrowButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('still allows selecting yesterday from the popover (create)', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn();
    const engine = createLogActivityEngine({ todayDate: TODAY, submitLog });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    await user.click(screen.getByTestId(DATE_PICKER_FIELD_TEST_ID));
    await user.click(screen.getByTestId(`date-picker-day-${YESTERDAY}`));

    expect(screen.getByTestId(DATE_PICKER_FIELD_TEST_ID)).not.toHaveTextContent('Today');
  });
});

// ---------------------------------------------------------------------------
// P25.5 — Calendar grid aligns with Monday-first column headers
// ---------------------------------------------------------------------------

function cellColumnIndex(grid: Element, testId: string): number {
  const children = Array.from(grid.children);
  const index = children.findIndex(
    child => child.getAttribute('data-testid') === testId,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index % 7;
}

describe('LogActivityScreen — P25.5 calendar column alignment', () => {
  it('places June 2026 dates under the correct Mon–Sun columns', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: '2026-06-07' });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    await user.click(screen.getByTestId(DATE_PICKER_FIELD_TEST_ID));

    const popover = findDatePickerPopover();
    expect(popover).not.toBeNull();
    const grids = popover!.querySelectorAll('.grid.grid-cols-7');
    const dayGrid = grids[grids.length - 1];
    expect(dayGrid).toBeDefined();

    // June 2026: 1st = Monday, 6th = Saturday, 7th = Sunday
    expect(cellColumnIndex(dayGrid!, 'date-picker-day-2026-06-01')).toBe(0);
    expect(cellColumnIndex(dayGrid!, 'date-picker-day-2026-06-06')).toBe(5);
    expect(cellColumnIndex(dayGrid!, 'date-picker-day-2026-06-07')).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// P25.5 — InlineLogSheet unchanged guard
// ---------------------------------------------------------------------------

describe('LogActivityScreen — P25.5 scope guard', () => {
  it('does not expose date-picker-popover markup before the field is opened', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(findDatePickerPopover()).toBeNull();
    expect(findDatePickerField()).not.toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('date-picker-modal')).not.toBeInTheDocument();
  });

  it('does not render a bottom-sheet drag handle on the closed date field card', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const field = screen.getByTestId(DATE_PICKER_FIELD_TEST_ID);
    expect(findDragHandle(field.closest('[class*="rounded-md"]') ?? field)).toBeNull();
    expect(isDatePickerBottomSheet(field.className)).toBe(false);
  });
});
