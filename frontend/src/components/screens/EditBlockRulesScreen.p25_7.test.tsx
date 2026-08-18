/**
 * P25.7 — Exercise-only volume caps with units
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: unit picker on volume-cap rules, limit_unit on create/patch.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult, RuleDraft } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import {
  P25_7_VOLUME_CAP_UNITS,
  expectVolumeCapUnitPickerOptions,
} from '../../test/ruleVolumeCaps';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

const CLASS_FOOT: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  loadWeight: 1,
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

const RULE_WALK_WEEKLY_KM: Rule & { limitUnit?: string } = {
  id: 'rule-walk-weekly-km',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  activityId: ACTIVITY_WALK.id,
  ruleType: 'weekly_volume_cap',
  thresholdValue: 12,
  windowDays: 7,
  limitUnit: 'km',
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

describe('EditBlockRulesScreen — P25.7 exercise volume caps', () => {
  it('shows unit picker with km, minutes, and hours when adding weekly volume cap', async () => {
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
    await user.selectOptions(typeSelect, 'weekly_volume_cap');

    const unitSelect = within(footSection).getByRole('combobox', {
      name: /volume unit/i,
    });
    expectVolumeCapUnitPickerOptions(unitSelect);
  });

  it('calls createRule with limitUnit when saving a new exercise volume cap', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [],
      createRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    await user.click(
      within(footSection).getByRole('button', { name: /add exercise rule/i }),
    );

    await user.selectOptions(
      within(footSection).getByRole('combobox', { name: /exercise/i }),
      ACTIVITY_WALK.id,
    );
    await user.selectOptions(
      within(footSection).getByRole('combobox', { name: /rule type/i }),
      'weekly_volume_cap',
    );
    await user.selectOptions(
      within(footSection).getByRole('combobox', { name: /volume unit/i }),
      'hours',
    );

    const thresholdInput = within(footSection).getByRole('spinbutton', {
      name: /threshold/i,
    });
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '3');

    await user.click(within(footSection).getByRole('button', { name: /save/i }));

    expect(createRule).toHaveBeenCalledTimes(1);
    const [draft] = createRule.mock.calls[0] as [RuleDraft & { limitUnit?: string }];
    expect(draft.ruleType).toBe('weekly_volume_cap');
    expect(draft.activityId).toBe(ACTIVITY_WALK.id);
    expect(draft.limitUnit).toBe('hours');
    expect(draft.thresholdValue).toBe(3);
  });

  it('displays the configured limit_unit on an existing volume-cap rule row', () => {
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_WALK_WEEKLY_KM],
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    expect(
      within(footSection).getByText(P25_6_RULE_LABELS.weekly_volume_cap),
    ).toBeInTheDocument();
    expect(within(footSection).getByText('km')).toBeInTheDocument();
    expect(within(footSection).queryByText('volume')).not.toBeInTheDocument();
  });

  it('calls updateRule with limitUnit when unit is changed on an existing volume cap', async () => {
    const user = userEvent.setup();
    const updateRule = vi.fn();
    const engine = makeEngine({
      block: ACTIVE_BLOCK,
      activityClasses: [CLASS_FOOT],
      activities: [ACTIVITY_WALK],
      rules: [RULE_WALK_WEEKLY_KM],
      updateRule,
    });

    renderWithProviders(
      <EditBlockRulesScreen engine={engine} onBack={vi.fn()} />,
    );

    const footSection = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);
    const unitSelect = within(footSection).getByRole('combobox', {
      name: /volume unit/i,
    });
    await user.selectOptions(unitSelect, 'minutes');

    expect(updateRule).toHaveBeenCalledWith(RULE_WALK_WEEKLY_KM.id, {
      limitUnit: 'minutes',
    });
  });

  it('does not show volume unit picker for non-volume exercise rules', async () => {
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
    await user.selectOptions(typeSelect, 'frequency_limit');

    expect(
      within(footSection).queryByRole('combobox', { name: /volume unit/i }),
    ).not.toBeInTheDocument();
    expect(P25_7_VOLUME_CAP_UNITS).toHaveLength(3);
  });
});
