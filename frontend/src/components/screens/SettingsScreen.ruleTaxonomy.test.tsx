/**
 * P25.6 — Rule taxonomy: Settings block summary labels
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: BlockSummaryCard recovery rules must use user-facing
 * names from the owner-signed taxonomy, not internal rule_type strings.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import type { ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { SettingsScreen } from './SettingsScreen';

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
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

const RULE_FREQ: Rule = {
  id: 'rule-freq-1',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'frequency_limit',
  thresholdValue: 3,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const RULE_CONSECUTIVE: Rule = {
  id: 'rule-consecutive-1',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'consecutive_day_limit',
  thresholdValue: 4,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-05-01T00:00:00Z',
};

function makeEngine(overrides: Partial<MilestoneEngineResult> = {}): MilestoneEngineResult {
  return {
    ...mockEngine,
    block: ACTIVE_BLOCK,
    activityClasses: [CLASS_RUNNING],
    weeklyTargets: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('SettingsScreen — P25.6 block summary rule labels', () => {
  it('shows user-facing names for rest_between_class, not legacy shorthand or rule_type', () => {
    const engine = makeEngine({ rules: [RULE_REST] });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.rest_between_class, 'i')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/min 2.day rest/i)).not.toBeInTheDocument();
    expect(screen.queryByText('rest_between_class')).not.toBeInTheDocument();
  });

  it('shows user-facing names for frequency_limit in the recovery rules summary', () => {
    const engine = makeEngine({ rules: [RULE_FREQ] });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.frequency_limit, 'i')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/max 3× \/ week/i)).not.toBeInTheDocument();
    expect(screen.queryByText('frequency_limit')).not.toBeInTheDocument();
  });

  it('shows user-facing names for consecutive_day_limit in the recovery rules summary', () => {
    const engine = makeEngine({ rules: [RULE_CONSECUTIVE] });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.consecutive_day_limit, 'i')),
    ).toBeInTheDocument();
    expect(screen.queryByText(/max 4 consecutive days/i)).not.toBeInTheDocument();
    expect(screen.queryByText('consecutive_day_limit')).not.toBeInTheDocument();
  });

  it('never surfaces weekly_load_cap labels in the block summary', () => {
    const loadCapRule: Rule = {
      id: 'rule-load-cap',
      trainingBlockId: ACTIVE_BLOCK.id,
      activityClassId: CLASS_RUNNING.id,
      ruleType: 'weekly_load_cap',
      thresholdValue: 120,
      windowDays: 7,
      enabled: true,
      createdAt: '2026-05-01T00:00:00Z',
    };

    const engine = makeEngine({ rules: [RULE_REST, loadCapRule] });

    renderWithProviders(<SettingsScreen engine={engine} />);

    expect(screen.queryByText(/load cap/i)).not.toBeInTheDocument();
    expect(screen.queryByText('weekly_load_cap')).not.toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.rest_between_class, 'i')),
    ).toBeInTheDocument();
  });
});
