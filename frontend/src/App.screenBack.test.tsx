/**
 * S2.4 — App-level screen back affordance on overlays and stack screens.
 * plans/tickets-stage-2-polish-2026-06-05.md
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/renderWithProviders';
import { mockEngine, resetMockEngine } from './test/mockEngine';
import {
  SCREEN_BACK_HEADER_TEST_ID,
  expectScreenBackHeaderHasSafeTop,
} from './test/screenBackLayout';
import type { Activity, ActivityClass } from './types';
import { App } from './App';

const SCREENS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'components/screens');

const TAB_ROOT_SCREENS = new Set([
  'DashboardScreen.tsx',
  'LogHistoryScreen.tsx',
  'GoalsScreen.tsx',
  'SettingsScreen.tsx',
  'LoginScreen.tsx',
]);

const SHEET_SCREENS = new Set(['NewActivitySheet.tsx', 'InlineLogSheet.tsx']);

const STACK_OR_OVERLAY_SCREENS = new Set([
  'MorningCheckInScreen.tsx',
  'LogActivityScreen.tsx',
  'LogIncidentScreen.tsx',
  'GoalEditorScreen.tsx',
  'EditBlockRulesScreen.tsx',
  'BlockReviewScreen.tsx',
  'NewTrainingBlockScreen.tsx',
  'ActivityManagerScreen.tsx',
]);

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

function expectSharedBackHeaderVisible(): HTMLElement {
  const header = screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID);
  expectScreenBackHeaderHasSafeTop(header);
  return header;
}

describe('S2.4 — non-tab screens must use shared back header (audit)', () => {
  it('every non-tab-root screen file imports shared back or is an allowed exception', () => {
    const screenFiles = readdirSync(SCREENS_DIR).filter((name) => name.endsWith('.tsx'));
    const offenders: string[] = [];

    for (const filename of screenFiles) {
      if (TAB_ROOT_SCREENS.has(filename) || SHEET_SCREENS.has(filename)) continue;
      if (!STACK_OR_OVERLAY_SCREENS.has(filename)) continue;

      const src = readFileSync(resolve(SCREENS_DIR, filename), 'utf8');
      const importsShared =
        /from ['"]\.\.\/ui\/(BackButton|ScreenBackHeader)['"]/.test(src);
      const hasLocalBack = /const BackButton\b/.test(src);
      if (!importsShared || hasLocalBack) {
        offenders.push(filename);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('S2.4 — App overlay flows use shared back header wired to navigateBack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('morning check-in overlay shows shared back header and returns to dashboard on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(screen.getByRole('button', { name: 'Complete morning check-in' }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.getByRole('heading', { name: /Good morning, Sam\./i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('log-activity overlay shows shared back header and returns to Log tab on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Activity' }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('log-incident overlay shows shared back header and returns to Log tab on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: '+ Log Incident' }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.getByRole('heading', { name: 'Log History' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});

describe('S2.4 — App stack flows use shared back header wired to navigateBack', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    mockEngine.activityClasses = [activityClass];
    mockEngine.activities = [activity];
  });

  afterEach(() => {
    cleanup();
  });

  it('goal-editor stack shows shared back header and pops on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Goals' }));
    await user.click(screen.getByRole('button', { name: /\+ new goal/i }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('edit-block-rules stack shows shared back header and pops on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /edit rules/i }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('block-review stack shows shared back header and pops on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('new-training-block stack shows shared back header and pops on back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.click(within(getPrimaryNav()).getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /\+ new training block/i }));
    expectSharedBackHeaderVisible();
    await user.click(within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole('button'));

    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

});
