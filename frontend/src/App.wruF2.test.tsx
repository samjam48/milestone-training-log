/**
 * WRU.F2 — Remove new training block screen and dead navigation (failing first, TDD).
 * plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F2
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';
import { mockEngine, resetMockEngine } from './test/mockEngine';

const FRONTEND_SRC = resolve(dirname(fileURLToPath(import.meta.url)));
const NEW_BLOCK_SCREEN = resolve(
  FRONTEND_SRC,
  'components/screens/NewTrainingBlockScreen.tsx',
);
const APP_PATH = resolve(FRONTEND_SRC, 'App.tsx');

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

function getPrimaryNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Primary' });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetMockEngine();
});

afterEach(() => {
  cleanup();
});

describe('WRU.F2 — NewTrainingBlockScreen removal', () => {
  it('deletes NewTrainingBlockScreen.tsx', () => {
    expect(existsSync(NEW_BLOCK_SCREEN)).toBe(false);
  });

  it('App.tsx does not register the new-training-block stack screen', () => {
    const src = readFileSync(APP_PATH, 'utf8');
    expect(src).not.toMatch(/new-training-block/);
    expect(src).not.toMatch(/NewTrainingBlockScreen/);
  });
});

describe('WRU.F2 — Settings has no new-block navigation', () => {
  it('does not expose + New Training Block in Settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));

    expect(
      screen.queryByRole('button', { name: /\+ new training block/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /new training block/i }),
    ).not.toBeInTheDocument();
  });

  it('does not push a new-training-block stack overlay from Settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /new training block/i })).not.toBeInTheDocument();
  });
});
