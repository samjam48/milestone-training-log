/**
 * P25.3 — Edit activity as centered modal (App integration)
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Settings must not push activity-manager stack when editing an activity.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/renderWithProviders';
import { mockEngine } from './test/mockEngine';
import { expectCenteredModalDialog } from './test/centeredModalLayout';
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('App — P25.3 edit activity centered modal', () => {
  it('opens edit activity as a centered modal without pushing the activity-manager stack', async () => {
    const user = userEvent.setup();
    const activityClass: ActivityClass = {
      id: 'cls-performance',
      userId: 'user-1',
      name: 'Performance',
      type: 'performance',
      defaultRecoveryWindowDays: 3,
      loadWeight: 1,
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
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^edit activity$/i })).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: /edit activity/i });
    expectCenteredModalDialog(dialog);
  });
});
