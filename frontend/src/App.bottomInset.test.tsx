/**
 * S2.1 — App-level bottom inset: tab screens vs full-screen overlays.
 * plans/tickets-stage-2-polish-2026-06-05.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/renderWithProviders';
import {
  APPSHELL_VIEWPORT_HEIGHT_CLASS,
  BOTTOM_ACTION_BAR_TEST_ID,
  expectSafeBottomOnlyInset,
  expectTabBarInsetAboveTabScreenFooter,
  findSafeBottomOnlyRegion,
  TAB_BAR_SAFE_BOTTOM_INSET,
} from './test/bottomInsetLayout';
import { mockEngine, resetMockEngine } from './test/mockEngine';
import type { Activity, ActivityClass } from './types';
import { App } from './App';

const bottomInsetActivityClass: ActivityClass = {
  id: 'cls-bottom-inset',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  loadWeight: 1,
  createdAt: '2026-04-07T06:00:00Z',
};

const bottomInsetActivity: Activity = {
  id: 'act-bottom-inset',
  userId: 'user-1',
  activityClassId: bottomInsetActivityClass.id,
  name: 'Morning Run',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-04-07T06:00:00Z',
};

vi.mock('./lib/api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue(undefined),
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

function getAppShellRoot(container: HTMLElement): HTMLElement {
  const shell = container.firstElementChild;
  expect(shell).not.toBeNull();
  return shell as HTMLElement;
}

function getPrimaryNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary' });
}

describe('App — S2.1 bottom inset layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses tabbar + safe-bottom on AppShell while the primary tab bar is visible', () => {
    const { container } = renderWithProviders(<App />);

    const shell = getAppShellRoot(container);
    expect(shell.className).toContain(TAB_BAR_SAFE_BOTTOM_INSET);
    expect(shell.className).toContain(APPSHELL_VIEWPORT_HEIGHT_CLASS);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('Log tab bottom-action-bar sits above tab bar via AppShell inset only', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));

    const actionBar = screen.getByTestId(BOTTOM_ACTION_BAR_TEST_ID);
    expectTabBarInsetAboveTabScreenFooter(actionBar);
    expect(within(actionBar).getByRole('button', { name: '+ Log Activity' })).toBeInTheDocument();
    expect(within(actionBar).getByRole('button', { name: '+ Log Incident' })).toBeInTheDocument();
  });

  it('Goals tab + Big goal uses AppShell inset, not duplicate footer padding', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));

    const actionBar = screen.getByTestId(BOTTOM_ACTION_BAR_TEST_ID);
    expectTabBarInsetAboveTabScreenFooter(actionBar);
    expect(within(actionBar).getByRole('button', { name: /big goal/i })).toBeInTheDocument();
    expect(within(actionBar).getByRole('button', { name: /weekly target/i })).toBeInTheDocument();
  });

  it('log-activity overlay uses safe-bottom only on AppShell (no tabbar padding)', async () => {
    const user = userEvent.setup();
    mockEngine.activityClasses = [bottomInsetActivityClass];
    mockEngine.activities = [bottomInsetActivity];
    const { container } = renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    const shell = getAppShellRoot(container);
    expectSafeBottomOnlyInset(shell);
    expect(shell.className).not.toContain('spacing.tabbar');

    const submit = screen.getByRole('button', { name: /log session|log anyway/i });
    expect(findSafeBottomOnlyRegion(submit)).not.toBeNull();
  });

  it('log-incident overlay uses safe-bottom only on AppShell and submit region', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    const shell = getAppShellRoot(container);
    expectSafeBottomOnlyInset(shell);

    const submit = screen.getByRole('button', { name: /record incident/i });
    expect(findSafeBottomOnlyRegion(submit)).not.toBeNull();
  });

  it('check-in overlay uses safe-bottom only on AppShell and submit region', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();

    const shell = getAppShellRoot(container);
    expectSafeBottomOnlyInset(shell);

    const submit = screen.getByRole('button', { name: /save check-in/i });
    expect(findSafeBottomOnlyRegion(submit)).not.toBeNull();
  });
});
