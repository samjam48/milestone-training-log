/**
 * F2.1 — NewActivitySheet component tests (failing first, TDD).
 *
 * Tests are written against the public contract defined in the ticket:
 *   Props: { open, onClose, activityClasses, onCreate, onCreated? }
 *
 * The component (NewActivitySheet.tsx) does NOT exist yet — all tests below
 * must fail until the implementation is in place.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { ActivityClass } from '../../types';
import type { NewActivityDraft } from '../../hooks/useMilestoneEngine';
import { NewActivitySheet } from './NewActivitySheet';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CLASS_STRENGTH: ActivityClass = {
  id: 'cls-strength',
  userId: 'user-1',
  name: 'Strength',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_MOBILITY: ActivityClass = {
  id: 'cls-mobility',
  userId: 'user-1',
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  loadWeight: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const TWO_CLASSES = [CLASS_STRENGTH, CLASS_MOBILITY];

function baseProps(overrides: Partial<Parameters<typeof NewActivitySheet>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    activityClasses: TWO_CLASSES,
    onCreate: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Renders with open=true; dialog in DOM, name input autofocused
// ---------------------------------------------------------------------------
describe('NewActivitySheet — open state', () => {
  it('renders the dialog when open=true', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal="true" on the dialog panel', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the name input with autofocus when open=true', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    const input = screen.getByRole('textbox', { name: /activity name/i });
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  // ---------------------------------------------------------------------------
  // 2. Renders with open=false; hidden/not in DOM
  // ---------------------------------------------------------------------------
  it('does not render the dialog when open=false', () => {
    renderWithProviders(<NewActivitySheet {...baseProps({ open: false })} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3–5. Close affordances: close button, scrim, Cancel button
// ---------------------------------------------------------------------------
describe('NewActivitySheet — close affordances', () => {
  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(<NewActivitySheet {...baseProps({ onClose })} />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

});

// ---------------------------------------------------------------------------
// 6. State resets when open flips from false → true
// ---------------------------------------------------------------------------
describe('NewActivitySheet — state reset on re-open', () => {
  it('resets name to empty string when open flips from false to true', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <NewActivitySheet {...baseProps({ open: true })} />,
    );

    const input = screen.getByRole('textbox', { name: /activity name/i });
    await user.type(input, 'My Activity');
    expect(input).toHaveValue('My Activity');

    // Close the sheet
    rerender(
      <NewActivitySheet {...baseProps({ open: false })} />,
    );

    // Re-open
    rerender(
      <NewActivitySheet {...baseProps({ open: true })} />,
    );

    expect(screen.getByRole('textbox', { name: /activity name/i })).toHaveValue('');
  });

  it('resets type to "performance" when re-opened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <NewActivitySheet {...baseProps({ open: true })} />,
    );

    // Switch type to Recovery
    await user.click(screen.getByRole('radio', { name: /recovery/i }));
    expect(screen.getByRole('radio', { name: /recovery/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Close and re-open
    rerender(<NewActivitySheet {...baseProps({ open: false })} />);
    rerender(<NewActivitySheet {...baseProps({ open: true })} />);

    expect(screen.getByRole('radio', { name: /performance/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('resets selected class to the first class when re-opened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <NewActivitySheet {...baseProps({ open: true })} />,
    );

    // Select the second class
    await user.click(screen.getByRole('button', { name: /mobility/i }));

    // Close and re-open
    rerender(<NewActivitySheet {...baseProps({ open: false })} />);
    rerender(<NewActivitySheet {...baseProps({ open: true })} />);

    // First class (Strength) should be selected again
    const strengthBtn = screen.getByRole('button', { name: /strength/i });
    // The selected class button has aria-pressed=true or a visual indicator;
    // test by confirming the first class row reflects selection state.
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// 7. Name input updates form state
// ---------------------------------------------------------------------------
describe('NewActivitySheet — name field', () => {
  it('updates the name input value as the user types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    const input = screen.getByRole('textbox', { name: /activity name/i });
    await user.type(input, 'Evening jog');

    expect(input).toHaveValue('Evening jog');
  });
});

// ---------------------------------------------------------------------------
// 8. Class picker single-select updates form state
// ---------------------------------------------------------------------------
describe('NewActivitySheet — class picker', () => {
  it('renders all provided activity classes', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('button', { name: /strength/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mobility/i })).toBeInTheDocument();
  });

  it('selects a class when its row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: /mobility/i }));

    expect(
      screen.getByRole('button', { name: /mobility/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('only has one class selected at a time (single-select)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: /mobility/i }));

    const strengthBtn = screen.getByRole('button', { name: /strength/i });
    expect(strengthBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// 9. Type segmented control (performance/recovery) works
// ---------------------------------------------------------------------------
describe('NewActivitySheet — type segmented control', () => {
  it('defaults to "performance" type', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('radio', { name: /performance/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /recovery/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('switches to "recovery" when that segment is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    await user.click(screen.getByRole('radio', { name: /recovery/i }));

    expect(screen.getByRole('radio', { name: /recovery/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /performance/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

// ---------------------------------------------------------------------------
// 10. Volume unit grid — all six units selectable
// ---------------------------------------------------------------------------
describe('NewActivitySheet — volume unit grid', () => {
  const UNITS = ['km', 'miles', 'minutes', 'reps', 'sets', 'sessions'] as const;

  it('renders all six volume unit options', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    for (const unit of UNITS) {
      expect(screen.getByRole('button', { name: unit })).toBeInTheDocument();
    }
  });

  it('defaults the selected unit to "km"', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('button', { name: 'km' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it.each(UNITS)('selects unit "%s" when clicked', async (unit) => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: unit }));

    expect(screen.getByRole('button', { name: unit })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

// ---------------------------------------------------------------------------
// 11. Submit disabled until name.trim() non-empty AND class selected
// ---------------------------------------------------------------------------
describe('NewActivitySheet — submit disabled guard', () => {
  it('disables the Create button initially (name empty)', () => {
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('keeps Create disabled when name is only whitespace', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      '   ',
    );

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // 12. Submit enabled once both name and class selected
  // ---------------------------------------------------------------------------
  it('enables Create once name has non-whitespace content and a class is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewActivitySheet {...baseProps()} />);

    // First class is selected by default
    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Yoga',
    );

    expect(screen.getByRole('button', { name: /create/i })).not.toBeDisabled();
  });

  it('keeps Create disabled when no class is selected (empty activityClasses)', () => {
    renderWithProviders(
      <NewActivitySheet {...baseProps({ activityClasses: [] })} />,
    );

    // Even if a name is typed, no class is available
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 13. On submit: calls onCreate with the correct draft shape
// ---------------------------------------------------------------------------
describe('NewActivitySheet — submit behaviour', () => {
  it('calls onCreate with { name, activityClassId, type, defaultVolumeUnit } on submit', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(
      <NewActivitySheet {...baseProps({ onCreate })} />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Morning Jog',
    );
    // Select Mobility class
    await user.click(screen.getByRole('button', { name: /mobility/i }));
    // Switch to Recovery
    await user.click(screen.getByRole('radio', { name: /recovery/i }));
    // Select "minutes" unit
    await user.click(screen.getByRole('button', { name: 'minutes' }));

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const draft = onCreate.mock.calls[0]![0] as NewActivityDraft;
    expect(draft.name).toBe('Morning Jog');
    expect(draft.activityClassId).toBe(CLASS_MOBILITY.id);
    expect(draft.type).toBe('recovery');
    expect(draft.defaultVolumeUnit).toBe('minutes');
  });

  it('submits defaultVolumeUnit as "mi" (not "miles") when the "miles" button is selected', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(
      <NewActivitySheet {...baseProps({ onCreate })} />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Road Run',
    );
    await user.click(screen.getByRole('button', { name: 'miles' }));

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const draft = onCreate.mock.calls[0]![0] as NewActivityDraft;
    expect(draft.defaultVolumeUnit).toBe('mi');
  });

  it('trims whitespace from the name before calling onCreate', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(<NewActivitySheet {...baseProps({ onCreate })} />);

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      '  Evening Run  ',
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect((onCreate.mock.calls[0]![0] as NewActivityDraft).name).toBe('Evening Run');
  });

  // ---------------------------------------------------------------------------
  // 14. On submit: calls onCreated callback
  // ---------------------------------------------------------------------------
  it('calls onCreated after onCreate on submit', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onCreated = vi.fn();

    renderWithProviders(
      <NewActivitySheet {...baseProps({ onCreate, onCreated })} />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Stretching',
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onCreated is not provided', async () => {
    const user = userEvent.setup();
    const { open, onClose, activityClasses, onCreate } = baseProps();
    // Explicitly omit onCreated — only pass the required props

    renderWithProviders(
      <NewActivitySheet
        open={open}
        onClose={onClose}
        activityClasses={activityClasses}
        onCreate={onCreate}
      />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Stretching',
    );

    await expect(
      user.click(screen.getByRole('button', { name: /create/i })),
    ).resolves.not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // 15. On submit: calls onClose
  // ---------------------------------------------------------------------------
  it('calls onClose after a successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <NewActivitySheet {...baseProps({ onClose })} />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Stretching',
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 16. On submit: the draft includes a client-generated UUID as `id`
  // ---------------------------------------------------------------------------
  it('passes a generated UUID id in the onCreate draft', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(<NewActivitySheet {...baseProps({ onCreate })} />);

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Biking',
    );

    await user.click(screen.getByRole('button', { name: /create/i }));

    const draft = onCreate.mock.calls[0]![0] as NewActivityDraft & { id: string };
    // UUID v4 pattern
    expect(draft.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

// ---------------------------------------------------------------------------
// 17–18. Empty activityClasses edge cases
// ---------------------------------------------------------------------------
describe('NewActivitySheet — empty activityClasses', () => {
  it('shows an empty state message when activityClasses is empty', () => {
    renderWithProviders(
      <NewActivitySheet {...baseProps({ activityClasses: [] })} />,
    );

    // Expect some kind of empty state text in the class picker section
    expect(
      screen.getByText(/no activity classes/i),
    ).toBeInTheDocument();
  });

  it('keeps submit disabled even if name is filled when no classes exist', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NewActivitySheet {...baseProps({ activityClasses: [] })} />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Run',
    );

    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // 18. Default class fallback to empty string when no classes
  // ---------------------------------------------------------------------------
  it('initialises classId to empty string when activityClasses is empty', () => {
    // This is an internal state invariant — verified indirectly via submit being
    // disabled (no class selected) and no class buttons being rendered.
    renderWithProviders(
      <NewActivitySheet {...baseProps({ activityClasses: [] })} />,
    );

    // No class buttons should be present
    expect(screen.queryByRole('button', { name: /strength/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mobility/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 19. Reset on open clears all fields (integration of reset behaviour)
// ---------------------------------------------------------------------------
describe('NewActivitySheet — full reset on re-open', () => {
  it('resets all fields to defaults when open flips false→true', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <NewActivitySheet {...baseProps({ open: true })} />,
    );

    // Mutate every field
    await user.type(
      screen.getByRole('textbox', { name: /activity name/i }),
      'Changed name',
    );
    await user.click(screen.getByRole('button', { name: /mobility/i }));
    await user.click(screen.getByRole('radio', { name: /recovery/i }));
    await user.click(screen.getByRole('button', { name: 'reps' }));

    // Close
    rerender(<NewActivitySheet {...baseProps({ open: false })} />);
    // Re-open
    rerender(<NewActivitySheet {...baseProps({ open: true })} />);

    // Name reset
    expect(screen.getByRole('textbox', { name: /activity name/i })).toHaveValue('');
    // Type reset to performance
    expect(screen.getByRole('radio', { name: /performance/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Unit reset to km
    expect(screen.getByRole('button', { name: 'km' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Class reset to first (Strength)
    expect(screen.getByRole('button', { name: /strength/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

