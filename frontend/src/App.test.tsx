/**
 * F1.1 — App shell acceptance tests
 *
 * Covers tab routing, Goals/Settings placeholders, and full-screen overlay flows.
 * Vitest harness (package.json, vitest.config.ts) is created by Implementer in F1.1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/renderWithProviders';
import {
  mockEngine,
  resetMockEngine,
  applyC63DashboardFixtures,
  c63CautionYogaSuggestion,
  c63DangerSquatSuggestion,
  c63SafeStretchSuggestion,
  c63StretchActivity,
  c63YogaActivity,
} from './test/mockEngine';
import type { Activity, ActivityClass } from './types';
import { App } from './App';

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./lib/api/client', () => ({
  apiFetch: apiFetchMock,
  apiFetchOrNullOn404: vi.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  isUnauthorizedError: (err: unknown): err is { status: number } =>
    err instanceof Error && 'status' in err && (err as { status: number }).status === 401,
}));

vi.mock('./hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

function getPrimaryNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary' });
}

function expectQuickLogSheet(activityName: string): void {
  expect(
    screen.getByRole('dialog', { name: new RegExp(`Quick log — ${activityName}`, 'i') }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: new RegExp(`^${activityName}$`, 'i') }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
}

function expectNoLogActivityPrefill(): void {
  expect(screen.queryByText('Session details')).not.toBeInTheDocument();
}

describe('App shell (F1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders primary navigation with four tabs', () => {
    renderWithProviders(<App />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Log' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Goals' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows Dashboard screen on initial load', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
  });

  it('navigates to Log History when Log tab is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
  });

  it('shows Goals screen on Goals tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    expect(screen.getByRole('heading', { name: /goals/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ new goal/i })).toBeInTheDocument();
  });

  it('shows Settings screen on Settings tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('opens Morning Check-In full-screen flow and returns to prior tab on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
    expect(screen.getByRole('heading', { name: 'Morning Check-In' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens Log Activity from Log tab and returns on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens Log Incident from Log tab and returns on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
    expect(screen.getByRole('heading', { name: 'Log Incident' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});

describe('Dashboard suggestion → InlineLogSheet quick log (C6.3 / F9.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    applyC63DashboardFixtures();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens InlineLogSheet with the safe suggestion activity when CTA is tapped', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expectQuickLogSheet('Stretching');
  });

  it('opens InlineLogSheet with the caution suggestion activity when CTA is tapped', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [c63CautionYogaSuggestion],
      activities: [c63StretchActivity, c63YogaActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log lightly' }));

    expectQuickLogSheet('Yoga');
  });

  it('does not apply stale prefill when opening Log Activity from the Log tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expectNoLogActivityPrefill();
  });

  it('clears quick-log state after sheet close so the next Log Activity open has no selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expectNoLogActivityPrefill();
  });

  it('opens the second suggestion activity after closing the first quick-log sheet', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [c63SafeStretchSuggestion, c63CautionYogaSuggestion],
      activities: [c63StretchActivity, c63YogaActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Log lightly' }));
    expectQuickLogSheet('Yoga');
    expect(
      screen.queryByRole('dialog', { name: /quick log — stretching/i }),
    ).not.toBeInTheDocument();
  });

  it('does not open quick log or Log Activity when suggestion id is not in activities', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [{ ...c63SafeStretchSuggestion, id: 'act-deleted' }],
      activities: [c63StretchActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expect(screen.queryByRole('dialog', { name: /quick log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
  });

  it('renders danger suggestions without a Log CTA on the dashboard', () => {
    applyC63DashboardFixtures({
      suggestions: [c63DangerSquatSuggestion],
      activities: [c63StretchActivity],
    });
    renderWithProviders(<App />);

    expect(screen.getByText('Heavy squat')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Log heavy squat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log lightly' })).not.toBeInTheDocument();
  });
});

describe('Screen stack — push/pop navigation (F8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('stack starts empty — initial render shows a tab screen with no stack overlay', () => {
    renderWithProviders(<App />);
    // The tab bar must be present (stack is empty, no overlay)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    // No stack overlay should exist on initial render
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
  });

  it('pushing goal-editor onto stack renders the overlay and hides the tab bar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    // Navigate to Goals tab and click the "+ New Goal" button which will push goal-editor
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    // Stack overlay must appear
    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    // Tab bar must be hidden when stack is non-empty
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('popping the stack removes the overlay and restores the tab bar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    // Push goal-editor onto the stack
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    // Pop the stack via the back button inside the overlay
    await user.click(screen.getByRole('button', { name: 'Back' }));

    // Overlay must be gone, tab bar restored
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — check-in overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — log-activity overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — log-incident overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('pushing an unknown stack key renders nothing (no crash, no overlay content)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    // Use the test affordance button to push an unknown key
    const triggerBtn = screen.queryByTestId('test-push-unknown-screen');
    if (triggerBtn !== null) {
      await user.click(triggerBtn);
      // An overlay wrapper may render but it should have no visible content
      const overlay = screen.queryByTestId('stack-screen-overlay');
      if (overlay !== null) {
        expect(overlay.textContent).toBe('');
      }
    } else {
      // If no test affordance exists yet, the implementation hasn't landed —
      // this path intentionally fails to signal missing test infrastructure.
      expect(screen.getByTestId('test-push-unknown-screen')).toBeInTheDocument();
    }
  });
});

describe('Settings stack navigation (F9.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens edit-block-rules through the visible Settings flow, then pops back out', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /edit rules/i }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /edit rules/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens block review through the visible Settings flow, then pops back out', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /block review/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens new-training-block through the visible Settings flow, then pops back out', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /\+ new training block/i }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /new training block/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('pushing activity-manager via its hidden affordance renders the overlay, hides the tab bar, and pops back out', async () => {
    const user = userEvent.setup();
    const activityClass: ActivityClass = {
      id: 'cls-performance',
      userId: 'user-1',
      name: 'Performance',
      type: 'performance',
      defaultRecoveryWindowDays: 3,
      createdAt: '2026-04-07T06:00:00Z',
    };
    const activity: Activity = {
      id: 'act-morning-run',
      userId: 'user-1',
      activityClassId: activityClass.id,
      name: 'Morning Run',
      type: 'performance',
      defaultVolumeUnit: 'km',
      isActive: true,
      createdAt: '2026-04-07T06:00:00Z',
    };
    mockEngine.activityClasses = [activityClass];
    mockEngine.activities = [activity];
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /edit morning run/i }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /edit activity/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('still renders nothing for an unknown stack key without crashing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByTestId('test-push-unknown-screen'));

    const overlay = screen.getByTestId('stack-screen-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });
});

/**
 * F10.7 — App-level loading and error shell (H10.2: isInitialLoading, isFatalError, refetchAll).
 * Implementer: App.tsx should branch on engine query status before tab/overlay content.
 */
describe('App shell — loading and fatal error (F10.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a dashboard skeleton inside AppShell while isInitialLoading', () => {
    mockEngine.isInitialLoading = true;
    renderWithProviders(<App />);

    expect(screen.getByTestId('app-dashboard-skeleton')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Good morning, Sam\./i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('shows full-column server error with Retry when isFatalError', () => {
    mockEngine.isFatalError = true;
    renderWithProviders(<App />);

    expect(screen.getByTestId('app-fatal-error')).toBeInTheDocument();
    expect(screen.getByText(/could not reach server/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Good morning, Sam\./i }),
    ).not.toBeInTheDocument();
  });

  it('calls refetchAll when Retry is pressed', async () => {
    const user = userEvent.setup();
    const refetchAll = vi.fn();
    mockEngine.isFatalError = true;
    mockEngine.refetchAll = refetchAll;
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('renders dashboard after Retry when fatal error clears', async () => {
    const user = userEvent.setup();
    mockEngine.isFatalError = true;
    mockEngine.refetchAll = vi.fn(() => {
      mockEngine.isFatalError = false;
    });
    const { rerender } = renderWithProviders(<App />);

    expect(screen.getByTestId('app-fatal-error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    rerender(<App />);

    expect(screen.queryByTestId('app-fatal-error')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
  });

  it('does not show fatal error shell when only non-dashboard signals fail', () => {
    mockEngine.isFatalError = false;
    mockEngine.isInitialLoading = false;
    mockEngine.delayedTaxError = true;
    renderWithProviders(<App />);

    expect(screen.queryByTestId('app-fatal-error')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
  });

  it('does not open morning check-in overlay while isFatalError', async () => {
    const user = userEvent.setup();
    mockEngine.isFatalError = true;
    renderWithProviders(<App />);

    const checkInCta = screen.queryByRole('button', { name: 'Complete morning check-in' });
    if (checkInCta !== null) {
      await user.click(checkInCta);
    }

    expect(screen.queryByRole('heading', { name: 'Morning Check-In' })).not.toBeInTheDocument();
  });
});

/**
 * F11.2 — Session gate: 401 → LoginScreen; authenticated shell after login.
 * Implementer: expose `isUnauthorized` on MilestoneEngineResult when dashboard
 * fetch returns 401; App branches before tab shell (distinct from isFatalError).
 */
describe('App — session auth gate (F11.2)', () => {
  type EngineWithAuth = typeof mockEngine & { isUnauthorized?: boolean };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    (mockEngine as EngineWithAuth).isUnauthorized = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows LoginScreen when engine reports isUnauthorized', () => {
    (mockEngine as EngineWithAuth).isUnauthorized = true;
    renderWithProviders(<App />);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Good morning, Sam\./i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('shows dashboard shell when engine is authorized and loaded', () => {
    (mockEngine as EngineWithAuth).isUnauthorized = false;
    mockEngine.isInitialLoading = false;
    mockEngine.isFatalError = false;
    renderWithProviders(<App />);

    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('does not treat unauthorized as fatal server error', () => {
    (mockEngine as EngineWithAuth).isUnauthorized = true;
    mockEngine.isFatalError = false;
    renderWithProviders(<App />);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('app-fatal-error')).not.toBeInTheDocument();
  });

  it('shows dashboard shell after successful login when session was unauthorized', async () => {
    const user = userEvent.setup();
    (mockEngine as EngineWithAuth).isUnauthorized = true;
    mockEngine.refetchAll = vi.fn(() => {
      (mockEngine as EngineWithAuth).isUnauthorized = false;
    });
    apiFetchMock.mockResolvedValueOnce({ ok: true });

    const { rerender } = renderWithProviders(<App />);
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/password/i), 'session-secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockEngine.refetchAll).toHaveBeenCalled();
    });

    rerender(<App />);

    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('returns to LoginScreen after Log out on Settings tab', async () => {
    const user = userEvent.setup();
    (mockEngine as EngineWithAuth).isUnauthorized = false;
    apiFetchMock.mockResolvedValueOnce(undefined);

    renderWithProviders(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      screen.queryByRole('heading', { name: /Good morning, Sam\./i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * F11.2 — Production dev-mode guard via App → Settings tab.
 */
describe('App — Settings dev reset hidden in prod (F11.2)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('does not show Reset mock data on Settings when VITE_DEV_MODE is false', async () => {
    vi.stubEnv('VITE_DEV_MODE', 'false');
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reset mock data/i }),
    ).not.toBeInTheDocument();
  });
});
