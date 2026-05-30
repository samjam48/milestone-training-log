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
