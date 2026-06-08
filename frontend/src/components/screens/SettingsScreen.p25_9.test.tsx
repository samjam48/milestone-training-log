/**
 * P25.9 — Remove weekly goal from Edit Rules (Settings copy)
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: block summary must not imply weekly goals are configured via Edit Rules.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';

import type { ActivityClass, Rule, TrainingBlock, WeeklyTarget } from '../../types';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { SettingsScreen } from './SettingsScreen';

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'May Rehab Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const RULE_REST: Rule = {
  id: 'rule-rest-1',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const WEEKLY_TARGET_RUNNING: WeeklyTarget = {
  id: 'wt-running-1',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  targetValue: 20,
  targetUnit: 'km',
  createdAt: '2026-05-01T00:00:00Z',
};

function makeEngine(overrides: Partial<typeof mockEngine> = {}): typeof mockEngine {
  return { ...mockEngine, ...overrides };
}

function getBlockSummarySection(): HTMLElement {
  const heading = screen.getByText(/^weekly rules$/i);
  const section = heading.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('SettingsScreen — P25.9 block summary copy', () => {
  it('does not list weekly targets in the active block summary card', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSummary = getBlockSummarySection();
    expect(within(blockSummary).queryByText(/weekly targets/i)).not.toBeInTheDocument();
    expect(within(blockSummary).queryByText(/weekly goal/i)).not.toBeInTheDocument();
    expect(within(blockSummary).queryByText(/20/)).not.toBeInTheDocument();
  });

  it('scopes Edit rules CTA to limits without weekly-goal helper copy', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSummary = getBlockSummarySection();
    const editRulesButton = within(blockSummary).getByRole('button', {
      name: /edit rules/i,
    });

    expect(editRulesButton).toBeInTheDocument();
    expect(within(blockSummary).queryByText(/weekly goal/i)).not.toBeInTheDocument();
    expect(editRulesButton.getAttribute('aria-description') ?? '').not.toMatch(
      /weekly goal/i,
    );
  });

  it('still shows recovery rules summary separate from aspirational targets', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      rules: [RULE_REST],
      weeklyTargets: [WEEKLY_TARGET_RUNNING],
      activityClasses: [CLASS_RUNNING],
    });

    renderWithProviders(<SettingsScreen engine={engine} />);

    const blockSummary = getBlockSummarySection();
    expect(within(blockSummary).getByText(/recovery rules/i)).toBeInTheDocument();
    expect(within(blockSummary).getByText(/minimum days between sessions/i)).toBeInTheDocument();
  });
});
