/**
 * F1.1 — App shell acceptance tests
 *
 * Covers tab routing, Goals/Settings placeholders, and full-screen overlay flows.
 * Vitest harness (package.json, vitest.config.ts) is created by Implementer in F1.1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/renderWithProviders';
import {
  spyOnBrowserHistory,
  dispatchPopState,
  bridgeHistoryBackToPopstate,
} from './test/navigationHistory';
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
import { createLogHistoryEngine } from './test/fixtures/c62Fixtures';
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
    await user.click(screen.getByRole('button', { name: /go back/i }));
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
    await user.click(screen.getByRole('button', { name: /go back/i }));
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
    await user.click(screen.getByRole('button', { name: /go back/i }));
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
      suggestionBuckets: [c63CautionYogaSuggestion],
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
      suggestionBuckets: [c63SafeStretchSuggestion, c63CautionYogaSuggestion],
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
      suggestionBuckets: [{ ...c63SafeStretchSuggestion, id: 'act-deleted' }],
      activities: [c63StretchActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expect(screen.queryByRole('dialog', { name: /quick log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
  });

  it('renders danger suggestions without a Log CTA on the dashboard', () => {
    applyC63DashboardFixtures({
      suggestionBuckets: [c63DangerSquatSuggestion],
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
    await user.click(screen.getByRole('button', { name: /go back/i }));

    // Overlay must be gone, tab bar restored
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — check-in overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — log-activity overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('regression — log-incident overlay still hides the tab bar and restores it on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));
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
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /edit rules/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));

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
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /block review/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));

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
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /new training block/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('opens edit activity as a centered modal without pushing a stack screen', async () => {
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

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /edit activity/i })).toBeInTheDocument();
  });

  it('still renders nothing for an unknown stack key without crashing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByTestId('test-push-unknown-screen'));

    const overlay = screen.getByTestId('stack-screen-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.textContent).toBe('');
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
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

  it('hides tab bar while initial dashboard load is pending', () => {
    (mockEngine as EngineWithAuth).isUnauthorized = false;
    mockEngine.isInitialLoading = true;
    mockEngine.isFatalError = false;
    renderWithProviders(<App />);

    expect(screen.getByTestId('app-dashboard-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-screen')).not.toBeInTheDocument();
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

/**
 * S2.3 — Browser history integration (Android system Back).
 * Implementer: sync overlay / screenStack with history.pushState, popstate,
 * history.back, and optional replaceState on authenticated shell entry.
 */
describe('S2.3 — Browser history integration (Android system Back)', () => {
  let historySpies: ReturnType<typeof spyOnBrowserHistory>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    historySpies = spyOnBrowserHistory();
  });

  afterEach(() => {
    historySpies.pushState.mockRestore();
    historySpies.replaceState.mockRestore();
    historySpies.back.mockRestore();
    cleanup();
  });

  it('pushes a history entry when opening the morning check-in overlay', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));

    expect(screen.getByRole('heading', { name: 'Morning Check-In' })).toBeInTheDocument();
    expect(historySpies.pushState).toHaveBeenCalled();
  });

  it('pushes a history entry when opening log-activity overlay from Log tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expect(historySpies.pushState).toHaveBeenCalled();
  });

  it('pushes a history entry when opening log-incident overlay from Log tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));

    expect(screen.getByRole('heading', { name: 'Log Incident' })).toBeInTheDocument();
    expect(historySpies.pushState).toHaveBeenCalled();
  });

  it('closes an open overlay on popstate and leaves the active tab unchanged', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    dispatchPopState();

    expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(within(getPrimaryNav()).getByRole('button', { name: 'Log' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('pushes a history entry when pushing a stack screen onto the navigation stack', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(historySpies.pushState).toHaveBeenCalled();
  });

  it('pops one stack level on popstate when the stack is two screens deep', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByTestId('test-push-unknown-screen'));
    await user.click(screen.getByTestId('test-push-unknown-screen'));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();

    dispatchPopState();
    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();

    dispatchPopState();
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('uses history.back when in-app Back closes a tab overlay', async () => {
    const restoreBack = bridgeHistoryBackToPopstate(historySpies.back);
    const user = userEvent.setup();
    renderWithProviders(<App />);

    try {
      await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
      await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
      expect(screen.getByRole('heading', { name: 'Log Incident' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /go back/i }));

      expect(historySpies.back).toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Log Incident' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    } finally {
      restoreBack();
    }
  });

  it('uses history.back when Done closes check-in overlay after successful submit', async () => {
    const restoreBack = bridgeHistoryBackToPopstate(historySpies.back);
    const user = userEvent.setup();
    renderWithProviders(<App />);

    try {
      await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
      expect(screen.getByRole('heading', { name: 'Morning Check-In' })).toBeInTheDocument();
      historySpies.back.mockClear();

      await user.click(screen.getByRole('button', { name: /save check-in/i }));
      expect(screen.getByText('Check-in logged.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^done$/i }));

      expect(historySpies.back).toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Morning Check-In' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();

      dispatchPopState();
      expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Morning Check-In' })).not.toBeInTheDocument();
    } finally {
      restoreBack();
    }
  });

  it('uses history.back when Done closes log-incident overlay after successful submit', async () => {
    const restoreBack = bridgeHistoryBackToPopstate(historySpies.back);
    const user = userEvent.setup();
    renderWithProviders(<App />);

    try {
      await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
      await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
      expect(screen.getByRole('heading', { name: 'Log Incident' })).toBeInTheDocument();
      historySpies.back.mockClear();

      await user.type(screen.getByPlaceholderText('e.g. Right toe'), 'Left heel');
      await user.click(screen.getByRole('button', { name: /record incident/i }));
      expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /^done$/i }));

      expect(historySpies.back).toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Log Incident' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();

      dispatchPopState();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Log Incident' })).not.toBeInTheDocument();
    } finally {
      restoreBack();
    }
  });

  it('uses history.back when log-activity overlay auto-closes after successful submit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const restoreBack = bridgeHistoryBackToPopstate(historySpies.back);
    applyC63DashboardFixtures();
    const user = userEvent.setup();
    renderWithProviders(<App />);

    try {
      await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
      await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
      expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
      historySpies.back.mockClear();

      await user.click(screen.getByRole('button', { name: 'Stretching' }));
      const durationLabel = screen.getByText('Duration');
      const durationField = durationLabel.parentElement;
      expect(durationField).not.toBeNull();
      await user.type(within(durationField!).getByRole('spinbutton'), '20');
      await user.click(screen.getByRole('button', { name: /log session/i }));

      expect(screen.getByText('Session logged.')).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(800);

      expect(historySpies.back).toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();

      dispatchPopState();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
    } finally {
      restoreBack();
      vi.useRealTimers();
    }
  });

  it('uses history.back when in-app Back pops a stack screen', async () => {
    const restoreBack = bridgeHistoryBackToPopstate(historySpies.back);
    const user = userEvent.setup();
    renderWithProviders(<App />);

    try {
      await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
      await user.click(screen.getByRole('button', { name: /edit rules/i }));
      expect(screen.getByRole('heading', { name: /edit rules/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /go back/i }));

      expect(historySpies.back).toHaveBeenCalled();
      expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    } finally {
      restoreBack();
    }
  });

  it('does not double-pop overlay state when popstate fires once', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
    expect(screen.getByRole('heading', { name: 'Morning Check-In' })).toBeInTheDocument();

    dispatchPopState();
    expect(screen.queryByRole('heading', { name: 'Morning Check-In' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();

    dispatchPopState();
    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Morning Check-In' })).not.toBeInTheDocument();
  });

  it('seeds history with replaceState when the authenticated shell first renders', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(historySpies.replaceState).toHaveBeenCalled();
  });

  it('seeds history with replaceState after transitioning from LoginScreen to the tab shell', async () => {
    type EngineWithAuth = typeof mockEngine & { isUnauthorized?: boolean };
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
      expect(mockEngine.refetchAll).toHaveBeenCalled();
    });
    rerender(<App />);

    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(historySpies.replaceState).toHaveBeenCalled();
  });

  it('does not push history entries on the login screen', () => {
    type EngineWithAuth = typeof mockEngine & { isUnauthorized?: boolean };
    (mockEngine as EngineWithAuth).isUnauthorized = true;
    renderWithProviders(<App />);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(historySpies.pushState).not.toHaveBeenCalled();
    expect(historySpies.replaceState).not.toHaveBeenCalled();
  });

  it('does not push history entries while the fatal error shell is shown', async () => {
    const user = userEvent.setup();
    mockEngine.isFatalError = true;
    renderWithProviders(<App />);

    expect(screen.getByTestId('app-fatal-error')).toBeInTheDocument();
    expect(historySpies.pushState).not.toHaveBeenCalled();

    const retry = screen.getByRole('button', { name: 'Retry' });
    await user.click(retry);
    expect(historySpies.pushState).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// S2.7 — NewActivitySheet wiring (plans/tickets-stage-2-polish-2026-06-05.md)
// ---------------------------------------------------------------------------

const s27ActivityClass: ActivityClass = {
  id: 'cls-s27-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-01-01T00:00:00Z',
};

function applyS27ActivityClassFixture(): void {
  mockEngine.activityClasses = [s27ActivityClass];
  mockEngine.activities = [];
}

function getNewActivityDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /create new activity/i });
}

describe('App — S2.7 NewActivitySheet wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    applyS27ActivityClassFixture();
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts NewActivitySheet and opens it from the Log tab + New Activity CTA', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));

    expect(getNewActivityDialog()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New Activity' })).toBeInTheDocument();
  });

  it('calls engine.submitNewActivity when the sheet form is submitted', async () => {
    const user = userEvent.setup();
    const submitNewActivity = vi.fn();
    mockEngine.submitNewActivity = submitNewActivity;
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));
    await user.type(screen.getByRole('textbox', { name: /activity name/i }), 'Evening jog');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(submitNewActivity).toHaveBeenCalledTimes(1);
    expect(submitNewActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Evening jog',
        activityClassId: s27ActivityClass.id,
        type: 'performance',
        defaultVolumeUnit: 'km',
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
      }),
    );
  });

  it('closes the sheet on Cancel without calling submitNewActivity', async () => {
    const user = userEvent.setup();
    const submitNewActivity = vi.fn();
    mockEngine.submitNewActivity = submitNewActivity;
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(submitNewActivity).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('dialog', { name: /create new activity/i }),
    ).not.toBeInTheDocument();
  });

  it('opens the same NewActivitySheet from Settings Activities + New Activity', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));

    expect(getNewActivityDialog()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows only one NewActivitySheet instance when opened from Log tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));

    expect(screen.getAllByRole('dialog', { name: /create new activity/i })).toHaveLength(1);
  });

  it('shows empty-class copy when no activity classes exist', async () => {
    const user = userEvent.setup();
    mockEngine.activityClasses = [];
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));

    expect(screen.getByText(/no activity classes/i)).toBeInTheDocument();
  });

  it('routes toward class creation when activityClasses is empty via Add activity class', async () => {
    const user = userEvent.setup();
    mockEngine.activityClasses = [];
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));
    await user.click(screen.getByRole('button', { name: /add activity class/i }));

    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText(/activity classes/i)).toBeInTheDocument();
  });

  it('opens log-activity overlay with the created activity pre-selected after sheet submit', async () => {
    const user = userEvent.setup();

    mockEngine.submitNewActivity = (draft) => {
      // Mirrors broken engine: mutation persists a different id than the sheet draft.
      mockEngine.activities = [
        {
          id: crypto.randomUUID(),
          userId: 'user-1',
          activityClassId: draft.activityClassId,
          name: draft.name,
          type: draft.type,
          defaultVolumeUnit: draft.defaultVolumeUnit,
          isActive: true,
          createdAt: '2026-06-06T00:00:00Z',
        },
      ];
    };

    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ New Activity' }));
    await user.type(screen.getByRole('textbox', { name: /activity name/i }), 'Evening jog');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(
      screen.queryByRole('dialog', { name: /create new activity/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    });

    expect(screen.getByText('Evening jog')).toBeInTheDocument();
    expect(screen.getByText('Session details')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S2.8 — Log Activity empty state (plans/tickets-stage-2-polish-2026-06-05.md)
// ---------------------------------------------------------------------------

describe('App — S2.8 Log Activity empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    applyS27ActivityClassFixture();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows empty state when opening log-activity with no active activities', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no activities yet/i)).toBeInTheDocument();
  });

  it('opens NewActivitySheet from Log Activity Create activity CTA', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    await user.click(screen.getByRole('button', { name: /create activity/i }));

    expect(getNewActivityDialog()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New Activity' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S25.F4 — Edit log stack route (plans/tickets-stage-2-5-usage-logic-2026-06-06.md)
// ---------------------------------------------------------------------------

describe('App — S25.F4 edit log flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    Object.assign(mockEngine, createLogHistoryEngine(1));
  });

  afterEach(() => {
    cleanup();
  });

  it('opens Edit Activity on the stack when Edit is tapped in Log History', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Activity' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('updates the history row after save triggers updateLog and a mocked refetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    const originalLog = mockEngine.logs[0]!;
    mockEngine.refetchAll = vi.fn();
    mockEngine.updateLog = vi.fn((logId, patch) => {
      mockEngine.logs = mockEngine.logs.map(log =>
        log.id === logId ? { ...log, ...patch } : log,
      );
      mockEngine.refetchAll();
    });

    renderWithProviders(<App />);

    try {
      await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
      expect(screen.getByText('20 min')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Edit' }));

      const durationLabel = screen.getByText('Duration');
      const durationField = durationLabel.parentElement;
      expect(durationField).not.toBeNull();
      const durationInput = within(durationField!).getByRole('spinbutton');
      fireEvent.change(durationInput, { target: { value: '45' } });
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(mockEngine.updateLog).toHaveBeenCalledWith(
        originalLog.id,
        expect.objectContaining({ durationMinutes: 45 }),
      );
      expect(mockEngine.refetchAll).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Session updated.')).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(800);

      expect(screen.queryByRole('heading', { name: 'Edit Activity' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();
      expect(screen.queryByText('20 min')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
