/**
 * Edit Rules compact row behavior.
 *
 * Rule rows should use a two-line mobile layout while preserving existing
 * mutations.
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

function getRuleShell(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  const rowShell = label.closest('.px-3');
  expect(rowShell).toBeInstanceOf(HTMLElement);
  return rowShell as HTMLElement;
}

function getFirstLine(rowShell: HTMLElement, labelText: string): HTMLElement {
  const label = within(rowShell).getByText(labelText);
  const firstLine = label.parentElement?.parentElement;
  expect(firstLine).toBeInstanceOf(HTMLElement);
  return firstLine as HTMLElement;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('EditBlockRulesScreen compact rule rows', () => {
  it('uses a two-line row: title and info on line 1 with the switch far right, controls and delete on line 2', () => {
    renderRules();

    const rowShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const firstLine = getFirstLine(rowShell, P25_6_RULE_LABELS.rest_between_class);
    const switchControl = within(rowShell).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    });
    const infoControl = within(rowShell).getByRole('button', {
      name: /minimum days between sessions info/i,
    });
    const thresholdInput = within(rowShell).getByRole('spinbutton', {
      name: P25_6_RULE_LABELS.rest_between_class,
    });
    const deleteControl = within(rowShell).getByRole('button', {
      name: /delete minimum days between sessions rule/i,
    });

    expect(within(firstLine).getByText(P25_6_RULE_LABELS.rest_between_class)).toBeInTheDocument();
    expect(within(firstLine).getByRole('button', {
      name: /minimum days between sessions info/i,
    })).toBe(infoControl);
    expect(within(firstLine).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    })).toBe(switchControl);
    expect(within(firstLine).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(firstLine).queryByRole('button', {
      name: /delete minimum days between sessions rule/i,
    })).not.toBeInTheDocument();
    expect(firstLine).toHaveClass('justify-between');

    const secondLine = thresholdInput.closest('.w-full');
    expect(secondLine).toBeInstanceOf(HTMLElement);
    expect(secondLine).not.toBe(firstLine);
    expect(within(secondLine as HTMLElement).getByRole('spinbutton', {
      name: P25_6_RULE_LABELS.rest_between_class,
    })).toBe(thresholdInput);
    expect(within(secondLine as HTMLElement).getByRole('button', {
      name: /delete minimum days between sessions rule/i,
    })).toBe(deleteControl);
  });

  it('orders threshold controls as minus, input, plus, then unit for static and volume units', () => {
    renderRules({
      rules: [RULE_REST, RULE_WEEKLY_VOLUME],
    });

    const restShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const restMinus = within(restShell).getByRole('button', {
      name: /decrease minimum days between sessions/i,
    });
    const restInput = within(restShell).getByRole('spinbutton', {
      name: P25_6_RULE_LABELS.rest_between_class,
    });
    const restPlus = within(restShell).getByRole('button', {
      name: /increase minimum days between sessions/i,
    });
    const restUnit = within(restShell).getByText('days');

    expectBefore(restMinus, restInput);
    expectBefore(restInput, restPlus);
    expectBefore(restPlus, restUnit);

    const volumeShell = getRuleShell(ACTIVITY_LONG_WALK.name);
    const volumeMinus = within(volumeShell).getByRole('button', {
      name: /decrease maximum volume per week/i,
    });
    const volumeInput = within(volumeShell).getByRole('spinbutton', {
      name: ACTIVITY_LONG_WALK.name,
    });
    const volumePlus = within(volumeShell).getByRole('button', {
      name: /increase maximum volume per week/i,
    });
    const volumeUnit = within(volumeShell).getByRole('combobox', {
      name: /volume unit/i,
    });

    expectBefore(volumeMinus, volumeInput);
    expectBefore(volumeInput, volumePlus);
    expectBefore(volumePlus, volumeUnit);
  });

  it('centers the threshold group independently from the delete action and uses mobile-sized numeric input', () => {
    renderRules({
      rules: [RULE_REST, RULE_WEEKLY_VOLUME],
    });

    const restShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const restInput = within(restShell).getByRole('spinbutton', {
      name: P25_6_RULE_LABELS.rest_between_class,
    });
    const restDelete = within(restShell).getByRole('button', {
      name: /delete minimum days between sessions rule/i,
    });
    const restControls = restInput.closest('.mx-auto');
    const restSecondLine = restInput.closest('.grid');
    expect(restControls).toBeInstanceOf(HTMLElement);
    expect(restSecondLine).toBeInstanceOf(HTMLElement);
    expect(restSecondLine).toHaveClass(
      'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]',
    );
    expect((restSecondLine as HTMLElement).children).toHaveLength(3);
    expect((restSecondLine as HTMLElement).children[0]).toHaveAttribute('aria-hidden', 'true');
    expect((restSecondLine as HTMLElement).children[1]).toBe(restControls);
    expect((restSecondLine as HTMLElement).children[2]).toContainElement(restDelete);
    expect(restControls).not.toContainElement(restDelete);
    expect(restInput.className).toMatch(/appearance-none|\[appearance:textfield\]/);

    const volumeShell = getRuleShell(ACTIVITY_LONG_WALK.name);
    const volumeInput = within(volumeShell).getByRole('spinbutton', {
      name: ACTIVITY_LONG_WALK.name,
    });
    const volumeDelete = within(volumeShell).getByRole('button', {
      name: /delete very long loaded uphill treadmill walking progression rule/i,
    });
    const volumeControls = volumeInput.closest('.mx-auto');
    const volumeSecondLine = volumeInput.closest('.grid');
    expect(volumeControls).toBeInstanceOf(HTMLElement);
    expect(volumeSecondLine).toBeInstanceOf(HTMLElement);
    expect(volumeSecondLine).toHaveClass(
      'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]',
    );
    expect((volumeSecondLine as HTMLElement).children).toHaveLength(3);
    expect((volumeSecondLine as HTMLElement).children[0]).toHaveAttribute('aria-hidden', 'true');
    expect((volumeSecondLine as HTMLElement).children[1]).toBe(volumeControls);
    expect((volumeSecondLine as HTMLElement).children[2]).toContainElement(volumeDelete);
    expect(volumeControls).not.toContainElement(volumeDelete);
    expect(volumeInput.className).toMatch(/appearance-none|\[appearance:textfield\]/);
  });

  it('groups the info affordance with the title on line 1, separate from the far-right toggle', () => {
    renderRules();

    const rowShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const firstLine = getFirstLine(rowShell, P25_6_RULE_LABELS.rest_between_class);
    const titleLabel = within(firstLine).getByText(P25_6_RULE_LABELS.rest_between_class);
    const infoControl = within(firstLine).getByRole('button', {
      name: /minimum days between sessions info/i,
    });
    const switchControl = within(firstLine).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    });

    // The title and the info button must share an immediate group container,
    // left-aligned together, distinct from the toggle's container.
    const titleGroup = titleLabel.closest('div');
    const infoGroup = infoControl.closest('div');
    const toggleGroup = switchControl.parentElement;

    expect(titleGroup).toBeInstanceOf(HTMLElement);
    expect(infoGroup).toBeInstanceOf(HTMLElement);
    expect(titleGroup).toBe(infoGroup);
    expect(titleGroup).not.toBe(toggleGroup);

    // Within that shared group, the title must come before the info button
    // (title text immediately followed by the info icon, not the other way
    // around), and the toggle must not be inside that group at all.
    expectBefore(titleLabel, infoControl);
    expect(within(titleGroup as HTMLElement).queryByRole('switch')).not.toBeInTheDocument();

    // The toggle must remain the last element on line 1, on the far right,
    // not grouped with the title/info pairing.
    expect(firstLine.lastElementChild).toBe(switchControl);
    expect((titleGroup as HTMLElement).contains(switchControl)).toBe(false);
  });

  it('sizes the title label to its own content instead of growing to fill the title/info group, so the info icon sits next to the visible text', () => {
    renderRules();

    const rowShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const firstLine = getFirstLine(rowShell, P25_6_RULE_LABELS.rest_between_class);
    const titleLabel = within(firstLine).getByText(P25_6_RULE_LABELS.rest_between_class);

    // A flex-grow class here would let the label consume the entire width of
    // the title/info group, shoving the info button away from the visible
    // text toward the far edge of the row. The label must size to its own
    // (possibly truncated) content instead.
    expect(titleLabel.className).not.toMatch(/\bflex-1\b/);
    expect(titleLabel.className).not.toMatch(/\bgrow\b/);

    // Truncation safety must survive without flex-1: long titles still need
    // to shrink and ellipsize rather than overflow the row.
    expect(titleLabel.className).toMatch(/\btruncate\b/);
    expect(titleLabel.className).toMatch(/\bmin-w-0\b/);
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
    expect(infoControl).toHaveClass('h-11', 'w-11');

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

    const rowShell = getRuleShell(P25_6_RULE_LABELS.rest_between_class);
    const firstLine = getFirstLine(rowShell, P25_6_RULE_LABELS.rest_between_class);
    const switchControl = within(rowShell).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    });
    const deleteControl = within(rowShell).getByRole('button', {
      name: /delete minimum days between sessions rule/i,
    });

    expect(switchControl).toHaveAttribute('aria-checked', 'false');
    expect(switchControl).toHaveClass('bg-border-strong');
    expect(within(firstLine).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.rest_between_class} enabled`,
    })).toBe(switchControl);
    expect(within(firstLine).queryByRole('button', {
      name: /delete minimum days between sessions rule/i,
    })).not.toBeInTheDocument();
    expect(deleteControl).toBeInTheDocument();
    expect(deleteControl.closest('.grid')).toHaveClass(
      'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]',
    );
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /increase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decrease/i })).not.toBeInTheDocument();
  });

  it('renders the worst-case indented volume row with a mobile-safe controls structure', () => {
    renderRules({
      rules: [RULE_WEEKLY_VOLUME],
    });

    const rowShell = getRuleShell(ACTIVITY_LONG_WALK.name);
    const label = within(rowShell).getByText(ACTIVITY_LONG_WALK.name);
    const firstLine = getFirstLine(rowShell, ACTIVITY_LONG_WALK.name);
    expect(rowShell).toHaveClass('pl-8');

    const controls = within(rowShell)
      .getByRole('spinbutton', { name: ACTIVITY_LONG_WALK.name })
      .closest('.mx-auto');
    expect(controls).toBeInstanceOf(HTMLElement);

    const deleteControl = within(rowShell).getByRole('button', {
      name: /delete very long loaded uphill treadmill walking progression rule/i,
    });
    const switchControl = within(rowShell).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.weekly_volume_cap} enabled`,
    });

    expect(label).toHaveClass('truncate');
    expect(within(firstLine).getByText(ACTIVITY_LONG_WALK.name)).toBe(label);
    expect(within(firstLine).getByRole('switch', {
      name: `${P25_6_RULE_LABELS.weekly_volume_cap} enabled`,
    })).toBe(switchControl);
    expect(firstLine).toHaveClass('justify-between');
    expect(deleteControl).toHaveClass('min-w-11');

    const controlsClasses = (controls as HTMLElement).className;

    expect(firstLine.className).toMatch(/\bmin-w-0\b/);
    expect(firstLine.className).toMatch(/\bflex\b/);
    expect(firstLine.className).toMatch(/\bitems-center\b/);

    // jsdom does not calculate the 375px overflow. Instead, this rendered test
    // asserts the narrow-row structure must have a concrete escape hatch for the
    // indented volume-cap case: a first line where the label may truncate before
    // the switch, and a centered controls group that is independent of delete.
    expect(`${firstLine.className} ${controlsClasses}`).toMatch(
      /\b(?:justify-between|mx-auto|grid|absolute|w-full|sm:)\b/,
    );
    expect(controls).not.toContainElement(deleteControl);
  });
});
