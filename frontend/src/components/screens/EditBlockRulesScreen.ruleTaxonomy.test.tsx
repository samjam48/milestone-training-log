/**
 * P25.6 — Rule taxonomy: plain labels & distinct helpers
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: Edit Rules must use owner-signed user-facing names,
 * show distinct helper copy, and exclude weekly_load_cap from add pickers.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import {
  P25_6_CLASS_ADD_RULE_TYPES,
  P25_6_EXERCISE_ADD_RULE_TYPES,
  P25_6_RULE_HELPERS,
  P25_6_RULE_LABELS,
  expectAddRulePickerExcludesLoadCap,
  expectAddRulePickerLabels,
  expectAddRulePickerValues,
  getSelectOptionValues,
} from '../../test/ruleTaxonomy';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_FOOT: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

const ACTIVITY_WALK: Activity = {
  id: 'act-walk',
  userId: 'user-1',
  activityClassId: CLASS_FOOT.id,
  name: 'Walk',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const RULE_REST: Rule = {
  id: 'rule-rest',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_FREQ: Rule = {
  id: 'rule-freq',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'frequency_limit',
  thresholdValue: 3,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_CONSECUTIVE: Rule = {
  id: 'rule-consecutive',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_RUNNING.id,
  ruleType: 'consecutive_day_limit',
  thresholdValue: 4,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

function makeEngine(overrides: Partial<MilestoneEngineResult> = {}): MilestoneEngineResult {
  return {
    ...mockEngine,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// P25.6 — User-facing row labels (not rule_type strings)
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — P25.6 user-facing rule labels', () => {
  it('renders owner-signed labels for each spacing rule type on existing rows', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_REST, RULE_FREQ, RULE_CONSECUTIVE],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(
      screen.getByText(P25_6_RULE_LABELS.rest_between_class),
    ).toBeInTheDocument();
    expect(screen.getByText(P25_6_RULE_LABELS.frequency_limit)).toBeInTheDocument();
    expect(
      screen.getByText(P25_6_RULE_LABELS.consecutive_day_limit),
    ).toBeInTheDocument();

    expect(screen.queryByText('rest_between_class')).not.toBeInTheDocument();
    expect(screen.queryByText('frequency_limit')).not.toBeInTheDocument();
    expect(screen.queryByText('consecutive_day_limit')).not.toBeInTheDocument();
    expect(screen.queryByText(/rest between class/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/frequency limit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/weekly load cap/i)).not.toBeInTheDocument();
  });

  it('uses user-facing labels as accessible names for threshold inputs', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_FREQ],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    expect(
      screen.getByRole('spinbutton', {
        name: P25_6_RULE_LABELS.frequency_limit,
      }),
    ).toHaveValue(3);
  });
});

// ---------------------------------------------------------------------------
// P25.6 — Distinct helper copy in add/edit flows
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — P25.6 rule helper copy', () => {
  it('reveals helper text from each spacing rule info control', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [RULE_REST, RULE_FREQ, RULE_CONSECUTIVE],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const runningSection = screen.getByTestId(`class-rules-${CLASS_RUNNING.id}`);

    expect(
      within(runningSection).queryByText(P25_6_RULE_HELPERS.rest_between_class),
    ).not.toBeInTheDocument();
    await user.click(
      within(runningSection).getByRole('button', {
        name: /minimum days between sessions info/i,
      }),
    );
    expect(
      within(runningSection).getByText(P25_6_RULE_HELPERS.rest_between_class),
    ).toBeInTheDocument();

    expect(
      within(runningSection).queryByText(P25_6_RULE_HELPERS.frequency_limit),
    ).not.toBeInTheDocument();
    await user.click(
      within(runningSection).getByRole('button', {
        name: /maximum sessions per week info/i,
      }),
    );
    expect(
      within(runningSection).getByText(P25_6_RULE_HELPERS.frequency_limit),
    ).toBeInTheDocument();

    expect(
      within(runningSection).queryByText(P25_6_RULE_HELPERS.consecutive_day_limit),
    ).not.toBeInTheDocument();
    await user.click(
      within(runningSection).getByRole('button', {
        name: /maximum consecutive days info/i,
      }),
    );
    expect(
      within(runningSection).getByText(P25_6_RULE_HELPERS.consecutive_day_limit),
    ).toBeInTheDocument();
  });

  it('updates helper text when the rule type changes in the class add-rule form', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const runningSection = screen.getByTestId(`class-rules-${CLASS_RUNNING.id}`);
    await user.click(
      within(runningSection).getByRole('button', { name: /add class cap/i }),
    );

    const typeSelect = within(runningSection).getByRole('combobox', {
      name: /rule type/i,
    });

    await user.selectOptions(typeSelect, 'frequency_limit');
    expect(
      within(runningSection).getByText(P25_6_RULE_HELPERS.frequency_limit),
    ).toBeInTheDocument();

    await user.selectOptions(typeSelect, 'consecutive_day_limit');
    expect(
      within(runningSection).getByText(P25_6_RULE_HELPERS.consecutive_day_limit),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// P25.6 — Add-rule pickers exclude weekly_load_cap
// ---------------------------------------------------------------------------

describe('EditBlockRulesScreen — P25.6 add-rule pickers', () => {
  it('class add-rule picker offers only the three spacing types', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_RUNNING],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const runningSection = screen.getByTestId(`class-rules-${CLASS_RUNNING.id}`);
    await user.click(
      within(runningSection).getByRole('button', { name: /add class cap/i }),
    );

    const typeSelect = within(runningSection).getByRole('combobox', {
      name: /rule type/i,
    });

    expectAddRulePickerValues(typeSelect, P25_6_CLASS_ADD_RULE_TYPES);
    expectAddRulePickerLabels(
      typeSelect,
      P25_6_CLASS_ADD_RULE_TYPES.map((type) => P25_6_RULE_LABELS[type]),
    );
    expectAddRulePickerExcludesLoadCap(typeSelect);
  });

  it('exercise add-rule picker offers spacing types plus volume caps, not weekly_load_cap', async () => {
    const user = userEvent.setup();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    await user.click(
      within(footSection).getByRole('button', { name: /add exercise rule/i }),
    );

    const typeSelect = within(footSection).getByRole('combobox', {
      name: /rule type/i,
    });

    expectAddRulePickerValues(typeSelect, P25_6_EXERCISE_ADD_RULE_TYPES);
    expectAddRulePickerLabels(
      typeSelect,
      P25_6_EXERCISE_ADD_RULE_TYPES.map((type) => P25_6_RULE_LABELS[type]),
    );
    expectAddRulePickerExcludesLoadCap(typeSelect);
    expect(getSelectOptionValues(typeSelect)).toContain('weekly_volume_cap');
    expect(getSelectOptionValues(typeSelect)).toContain('daily_volume_cap');
  });
});
