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
import { mockEngine } from './test/mockEngine';
import { App } from './App';

vi.mock('./hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

function getPrimaryNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary' });
}

describe('App shell (F1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('shows Coming soon placeholder on Goals tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('shows Coming soon placeholder on Settings tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
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
