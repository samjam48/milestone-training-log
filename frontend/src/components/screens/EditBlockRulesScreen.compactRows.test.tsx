/**
 * Edit Rules compact row behavior.
 *
 * Rule rows should compress to one row with switch, label, info,
 * controls, and DeleteButton while preserving existing mutations.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { getRuleHelper } from '../../lib/ruleTaxonomy';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import { EditBlockRulesScreen } from './EditBlockRulesScreen';

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

const ACTIVITY_LONG_WALK: Activity = {
  id: 'act-long-walk',
  userId: 'user-1',
  activityClassId: CLASS_FOOT.id,
  name: 'Very long loaded uphill treadmill walking progression',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const RULE_REST: Rule = {
  id: 'rule-rest',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  ruleType: 'rest_between_class',
  thresholdValue: 2,
  windowDays: 7,
  enabled: true,
  createdAt: '2026-06-01T00:00:00Z',
};

const RULE_REST_DISABLED: Rule = {
  ...RULE_REST,
  enabled: false,
};

const RULE_WEEKLY_VOLUME: Rule = {
  id: 'rule-weekly-volume',
  trainingBlockId: ACTIVE_BLOCK.id,
  activityClassId: CLASS_FOOT.id,
  activityId: ACTIVITY_LONG_WALK.id,
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

function renderRules(
  overrides: Partial<MilestoneEngineResult> = {},
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EditBlockRulesScreen
      engine={makeEngine({
        block: ACTIVE_BLOCK,
        activityClasses: [CLASS_FOOT],
        activities: [ACTIVITY_LONG_WALK],
        rules: [RULE_REST],
        ...overrides,
      })}
      onBack={vi.fn()}
    />,
  );
}

function expectBefore(left: Element, right: Element): void {
  expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('EditBlockRulesScreen compact rule rows', () => {
  it('orders each row as switch, label, info, value controls, then delete', () => {
    renderRules();

    const label = screen.getByText(P25_6_RULE_LABELS.rest_between_class);
    const switchControl = screen.getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    });
    const infoControl = screen.getByRole('button', {
      name: /minimum days between sessions info/i,
    });
    const thresholdInput = screen.getByRole('spinbutton', {
      name: P25_6_RULE_LABELS.rest_between_class,
    });
    const deleteControl = screen.getByRole('button', {
      name: /delete minimum days between sessions rule/i,
    });

    expectBefore(switchControl, label);
    expectBefore(label, infoControl);
    expectBefore(infoControl, thresholdInput);
    expectBefore(thresholdInput, deleteControl);
  });

  it('moves helper copy out of permanent row text and exposes it through a touch-reachable info control', async () => {
    const user = userEvent.setup();
    const helperText = getRuleHelper('rest_between_class');
    expect(helperText).toBeDefined();

    renderRules();

    expect(screen.queryByText(helperText!)).not.toBeInTheDocument();

    const infoControl = screen.getByRole('button', {
      name: /minimum days between sessions info/i,
    });
    expect(infoControl).toHaveAttribute('aria-label');

    await user.click(infoControl);

    expect(screen.getByText(helperText!)).toBeInTheDocument();
  });

  it('keeps toggle, threshold, unit, stepper, and delete mutations wired from the compact row', async () => {
    const user = userEvent.setup();
    const updateRule = vi.fn();
    const deleteRule = vi.fn();
    renderRules({
      rules: [RULE_WEEKLY_VOLUME],
      updateRule,
      deleteRule,
    });

    await user.click(
      screen.getByRole('switch', {
        name: `${P25_6_RULE_LABELS.weekly_volume_cap} enabled`,
      }),
    );
    expect(updateRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id, {
      enabled: false,
    });

    await user.click(screen.getByRole('button', { name: /increase maximum volume per week/i }));
    expect(updateRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id, {
      thresholdValue: 13,
    });

    await user.click(screen.getByRole('button', { name: /decrease maximum volume per week/i }));
    expect(updateRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id, {
      thresholdValue: 12,
    });

    const thresholdInput = screen.getByRole('spinbutton', {
      name: ACTIVITY_LONG_WALK.name,
    });
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '15');
    await user.tab();
    expect(updateRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id, {
      thresholdValue: 15,
    });

    await user.selectOptions(
      screen.getByRole('combobox', { name: /volume unit/i }),
      'hours',
    );
    expect(updateRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id, {
      limitUnit: 'hours',
    });

    await user.click(screen.getByRole('button', {
      name: /delete very long loaded uphill treadmill walking progression rule/i,
    }));
    expect(deleteRule).toHaveBeenCalledWith(RULE_WEEKLY_VOLUME.id);
  });

  it('shows volume-cap units as a select and non-volume units as static compact text', () => {
    renderRules({
      rules: [RULE_REST, RULE_WEEKLY_VOLUME],
    });

    const section = screen.getByTestId(`class-rules-${CLASS_FOOT.id}`);

    expect(
      within(section).getByRole('combobox', { name: /volume unit/i }),
    ).toHaveValue('km');
    expect(within(section).getByText('days')).toBeInTheDocument();
  });

  it('keeps disabled rules visibly off without exposing threshold controls', () => {
    renderRules({
      rules: [RULE_REST_DISABLED],
    });

    const switchControl = screen.getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    });

    expect(switchControl).toHaveAttribute('aria-checked', 'false');
    expect(switchControl).toHaveClass('bg-border-strong');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /increase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decrease/i })).not.toBeInTheDocument();
  });

  it('renders the worst-case indented volume row with a mobile-safe controls structure', () => {
    renderRules({
      rules: [RULE_WEEKLY_VOLUME],
    });

    const label = screen.getByText(ACTIVITY_LONG_WALK.name);
    const rowShell = label.closest('.px-3');
    expect(rowShell).toBeInstanceOf(HTMLElement);
    expect(rowShell).toHaveClass('pl-8');

    const row = within(rowShell as HTMLElement)
      .getByRole('switch', { name: `${P25_6_RULE_LABELS.weekly_volume_cap} enabled` })
      .closest('.min-w-0');
    expect(row).toBeInstanceOf(HTMLElement);

    const controls = within(row as HTMLElement)
      .getByRole('spinbutton', { name: ACTIVITY_LONG_WALK.name })
      .closest('div');
    expect(controls).toBeInstanceOf(HTMLElement);

    const deleteControl = within(row as HTMLElement).getByRole('button', {
      name: /delete very long loaded uphill treadmill walking progression rule/i,
    });

    expect(label).toHaveClass('truncate');
    expect(deleteControl).toHaveClass('min-w-11');

    const rowClasses = (row as HTMLElement).className;
    const controlsClasses = (controls as HTMLElement).className;

    expect(rowClasses).toMatch(/\bmin-w-0\b/);
    expect(rowClasses).toMatch(/\bflex\b/);
    expect(rowClasses).toMatch(/\bitems-center\b/);

    // jsdom does not calculate the 375px overflow. Instead, this rendered test
    // asserts the narrow-row structure must have a concrete escape hatch for the
    // indented volume-cap case: responsive wrapping, responsive controls
    // placement, or a compact controls group that is not always-inline at xs.
    expect(`${rowClasses} ${controlsClasses}`).toMatch(
      /\b(?:flex-wrap|flex-col|basis-full|w-full|sm:flex-nowrap|sm:basis-auto|max-sm:|min-\[|xs:)\b/,
    );
  });
});
