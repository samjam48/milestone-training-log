/**
 * Actionable empty-state cards (LogHistoryScreen)
 *
 * These tests describe expected behavior:
 *   - The Log History empty state currently has no "Log your first session" button
 *     inside the empty-state region; the only log-activity trigger is the bottom
 *     action bar button ("+ Log Activity"), which is outside the empty state.
 *
 * Acceptance criteria covered:
 *
 *   AC-1  Empty state: a "Log your first session" button is rendered inside the
 *         log-history-empty-state region when there are no logs.
 *   AC-2  Clicking "Log your first session" calls onOpenLogActivity.
 *   AC-3  "Log your first session" button is not rendered when onOpenLogActivity
 *         is not provided (graceful hide — no dead button).
 *         NOTE: onOpenLogActivity is currently required on LogHistoryScreen.
 *         The implementer must make it optional to satisfy this AC.
 *   AC-4  Non-empty state: "Log your first session" button is NOT present when
 *         logs exist (existing log rows shown instead).
 *   AC-5  Existing empty-state content is preserved (illustration, "No sessions
 *         logged yet" copy, bottom action bar CTAs).
 *
 * Mocking strategy: reuses createLogHistoryEngine from c62Fixtures (same pattern
 * as LogHistoryScreen.test.tsx).
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createLogHistoryEngine } from '../../test/fixtures/c62Fixtures';
import { LogHistoryScreen } from './LogHistoryScreen';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC-1: "Log your first session" button exists in the empty-state region
// ---------------------------------------------------------------------------

describe('LogHistoryScreen — empty state CTA', () => {
  it('AC-1: renders a "Log your first session" button inside the empty-state region when there are no logs', () => {
    const engine = createLogHistoryEngine(0);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    const emptyState = screen.getByTestId('log-history-empty-state');
    const cta = within(emptyState).getByRole('button', { name: /log your first session/i });
    expect(cta).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-2: Clicking the CTA calls onOpenLogActivity
  // ---------------------------------------------------------------------------

  it('AC-2: clicking "Log your first session" calls onOpenLogActivity', async () => {
    const user = userEvent.setup();
    const onOpenLogActivity = vi.fn();
    const engine = createLogHistoryEngine(0);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={onOpenLogActivity}
        onOpenLogIncident={vi.fn()}
      />,
    );

    const emptyState = screen.getByTestId('log-history-empty-state');
    const cta = within(emptyState).getByRole('button', { name: /log your first session/i });
    await user.click(cta);

    expect(onOpenLogActivity).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // AC-3: CTA is hidden when onOpenLogActivity is not provided
  // ---------------------------------------------------------------------------

  it('AC-3: "Log your first session" button is absent when onOpenLogActivity is not provided', () => {
    const engine = createLogHistoryEngine(0);

    // Cast to bypass required-prop constraint; the implementer must make this prop optional.
    const LogHistoryOptional = LogHistoryScreen as React.FC<{
      engine: typeof engine;
      onOpenLogActivity?: () => void;
      onOpenLogIncident: () => void;
    }>;

    renderWithProviders(
      <LogHistoryOptional
        engine={engine}
        onOpenLogIncident={vi.fn()}
      />,
    );

    const emptyState = screen.getByTestId('log-history-empty-state');
    expect(
      within(emptyState).queryByRole('button', { name: /log your first session/i }),
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-4: Non-empty state — no CTA in the content area
  // ---------------------------------------------------------------------------

  it('AC-4: "Log your first session" button is NOT present when logs exist', () => {
    const engine = createLogHistoryEngine(3);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    // Empty state itself must not render
    expect(screen.queryByTestId('log-history-empty-state')).not.toBeInTheDocument();
    // No first-session CTA anywhere on the page
    expect(
      screen.queryByRole('button', { name: /log your first session/i }),
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-5: Existing empty-state content is preserved
  // ---------------------------------------------------------------------------

  it('AC-5a: illustration is still present in the empty state alongside the new CTA', () => {
    const engine = createLogHistoryEngine(0);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    const emptyState = screen.getByTestId('log-history-empty-state');
    expect(within(emptyState).getByTestId('log-history-empty-illustration')).toBeInTheDocument();
  });

  it('AC-5b: "No sessions logged yet" copy is still present in the empty state alongside the new CTA', () => {
    const engine = createLogHistoryEngine(0);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    const emptyState = screen.getByTestId('log-history-empty-state');
    expect(within(emptyState).getByText(/no sessions logged yet/i)).toBeInTheDocument();
  });

  it('AC-5c: bottom action bar "+ Log Activity" and "+ Log Incident" CTAs still visible when empty', () => {
    const engine = createLogHistoryEngine(0);

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '+ Log Activity' })).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Log Incident' })).toBeVisible();
  });
});
