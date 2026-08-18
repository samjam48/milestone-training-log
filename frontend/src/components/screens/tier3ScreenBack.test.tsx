/**
 * S2.4 — Tier 3 / stack screens use shared screen-back-header with safe-top.
 * plans/tickets-stage-2-polish-2026-06-05.md
 */
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import {
  SCREEN_BACK_HEADER_TEST_ID,
  expectScreenBackHeaderHasSafeTop,
  withSafeTopAncestor,
} from '../../test/screenBackLayout';
import type { Activity, ActivityClass } from '../../types';
import { MorningCheckInScreen } from './MorningCheckInScreen';
import { LogActivityScreen } from './LogActivityScreen';
import { LogIncidentScreen } from './LogIncidentScreen';
import { GoalEditorScreen } from './GoalEditorScreen';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';
import { BlockReviewScreen } from './BlockReviewScreen';
import { ActivityManagerScreen } from './ActivityManagerScreen';

const SCREENS_DIR = resolve(dirname(fileURLToPath(import.meta.url)));

const TIER3_STACK_SCREEN_FILES = [
  'MorningCheckInScreen.tsx',
  'LogActivityScreen.tsx',
  'LogIncidentScreen.tsx',
  'GoalEditorScreen.tsx',
  'EditBlockRulesScreen.tsx',
  'BlockReviewScreen.tsx',
  'ActivityManagerScreen.tsx',
] as const;

const SHARED_BACK_IMPORT =
  /from ['"]\.\.\/ui\/(BackButton|ScreenBackHeader)['"]/;
const LOCAL_BACK_COMPONENT = /const BackButton\b/;

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_RUNNING: Activity = {
  id: 'act-running',
  userId: 'user-1',
  activityClassId: CLASS_RUNNING.id,
  name: 'Morning Run',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

function expectSharedBackHeaderRenders(ui: React.ReactElement): void {
  renderWithProviders(withSafeTopAncestor(ui));
  const header = screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID);
  expectScreenBackHeaderHasSafeTop(header);
}

describe('S2.4 — Tier 3 / stack screen back header (source audit)', () => {
  it.each(TIER3_STACK_SCREEN_FILES)(
    '%s imports shared BackButton or ScreenBackHeader (no local duplicate)',
    (filename) => {
      const src = readFileSync(resolve(SCREENS_DIR, filename), 'utf8');
      expect(src).toMatch(SHARED_BACK_IMPORT);
      expect(src).not.toMatch(LOCAL_BACK_COMPONENT);
    },
  );
});

describe('S2.4 — Tier 3 / stack screen back header (RTL)', () => {
  beforeEach(() => {
    resetMockEngine();
    mockEngine.activityClasses = [CLASS_RUNNING];
    mockEngine.activities = [ACTIVITY_RUNNING];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('MorningCheckInScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <MorningCheckInScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );
  });

  it('LogActivityScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <LogActivityScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );
  });

  it('LogIncidentScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );
  });

  it('GoalEditorScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <GoalEditorScreen
        goal={null}
        engine={mockEngine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
  });

  it('EditBlockRulesScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <EditBlockRulesScreen engine={mockEngine} onBack={vi.fn()} />,
    );
  });

  it('BlockReviewScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <BlockReviewScreen engine={mockEngine} blockId="blk-active" onBack={vi.fn()} />,
    );
  });

  it('ActivityManagerScreen renders shared back header with safe-top', () => {
    expectSharedBackHeaderRenders(
      <ActivityManagerScreen
        activity={ACTIVITY_RUNNING}
        engine={mockEngine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );
  });

  it('MorningCheckInScreen back control calls onBack when activated', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <MorningCheckInScreen engine={mockEngine} onBack={onBack} onComplete={vi.fn()} />,
    );
    await user.click(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID).querySelector('button')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('LogIncidentScreen back control calls onBack when activated', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <LogIncidentScreen engine={mockEngine} onBack={onBack} onComplete={vi.fn()} />,
    );
    await user.click(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID).querySelector('button')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('GoalEditorScreen back control calls onBack when activated', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <GoalEditorScreen
        goal={null}
        engine={mockEngine}
        onBack={onBack}
        onComplete={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID).querySelector('button')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
