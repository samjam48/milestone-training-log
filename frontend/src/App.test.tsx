/**
 * F1.1 — App shell acceptance tests
 *
 * Covers tab routing, Goals/Settings placeholders, and full-screen overlay flows.
 * Vitest harness (package.json, vitest.config.ts) is created by Implementer in F1.1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
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
import { App } from './App';

vi.mock('./hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

function getPrimaryNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary' });
}

function expectLogActivityPrefill(activityName: string): void {
  expect(screen.getByText('Session details')).toBeInTheDocument();
  const row = screen.getByRole('button', { name: activityName });
  expect(row.querySelector('svg')).not.toBeNull();
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

describe('Dashboard suggestion → Log Activity prefill (C6.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    applyC63DashboardFixtures();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens Log Activity with safe suggestion activity pre-selected when CTA is tapped', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expectLogActivityPrefill('Stretching');
  });

  it('opens Log Activity with caution suggestion activity pre-selected when CTA is tapped', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [c63CautionYogaSuggestion],
      activities: [c63StretchActivity, c63YogaActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log lightly' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expectLogActivityPrefill('Yoga');
  });

  it('does not apply stale prefill when opening Log Activity from the Log tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectLogActivityPrefill('Stretching');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expectNoLogActivityPrefill();
  });

  it('clears prefill after overlay close so the next Log Activity open has no selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectLogActivityPrefill('Stretching');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectLogActivityPrefill('Stretching');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expectNoLogActivityPrefill();
  });

  it('overwrites prefill when a second suggestion CTA is opened after closing the overlay', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [c63SafeStretchSuggestion, c63CautionYogaSuggestion],
      activities: [c63StretchActivity, c63YogaActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectLogActivityPrefill('Stretching');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.click(screen.getByRole('button', { name: 'Log lightly' }));
    expectLogActivityPrefill('Yoga');
    expect(screen.queryByRole('button', { name: 'Stretching' })?.querySelector('svg')).toBeNull();
  });

  it('ignores prefill when suggestion id is not in activities', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [{ ...c63SafeStretchSuggestion, id: 'act-deleted' }],
      activities: [c63StretchActivity],
    });
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expectNoLogActivityPrefill();
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

  it.each([
    {
      stackKey: 'block-review',
      testId: 'test-push-block-review',
      expectedHeading: /block review/i,
    },
    {
      stackKey: 'new-training-block',
      testId: 'test-push-new-training-block',
      expectedHeading: /new training block/i,
    },
    {
      stackKey: 'activity-manager',
      testId: 'test-push-activity-manager',
      expectedHeading: /edit activity/i,
    },
  ])(
    'pushing $stackKey via its hidden affordance renders the overlay, hides the tab bar, and pops back out',
    async ({ testId, expectedHeading }) => {
      const user = userEvent.setup();
      renderWithProviders(<App />);

      await user.click(screen.getByTestId(testId));

      expect(screen.getByTestId('stack-screen-overlay')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: expectedHeading })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    },
  );

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
