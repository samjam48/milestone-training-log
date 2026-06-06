/**
 * P25.8 — Edit Rules: surface API errors on rule create
 * plans/tickets-stage-2-5-polish-followup-2026-06-06.md
 *
 * Failing-first tests: inline add-rule form errors from hook mutation state.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Activity, ActivityClass, Rule, TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
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

function makeEngine(
  overrides: Partial<MilestoneEngineResult> & {
    ruleMutationError?: string | null;
    clearRuleMutationError?: () => void;
  } = {},
): MilestoneEngineResult {
  const { ruleMutationError = null, clearRuleMutationError = vi.fn(), ...engineOverrides } =
    overrides;

  return {
    ...mockEngine,
    ...engineOverrides,
    ruleMutationError,
    clearRuleMutationError,
  } as MilestoneEngineResult;
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('EditBlockRulesScreen — P25.8 rule mutation errors', () => {
  it('shows inline 409 error on class cap add form when createRule fails', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const clearRuleMutationError = vi.fn();

    const { rerender } = renderWithProviders(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_RUNNING],
          rules: [],
          createRule,
          clearRuleMutationError,
          ruleMutationError: null,
        })}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add class cap/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(createRule).toHaveBeenCalledTimes(1);

    rerender(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_RUNNING],
          rules: [],
          createRule,
          clearRuleMutationError,
          ruleMutationError: 'Rule already exists',
        })}
        onBack={vi.fn()}
      />,
    );

    const addForm = screen.getByRole('button', { name: /^save$/i }).closest('div');
    expect(addForm).not.toBeNull();
    expect(
      within(addForm!.parentElement as HTMLElement).getByRole('alert'),
    ).toHaveTextContent(/rule already exists/i);
  });

  it('shows inline 422 error on exercise rule add form when createRule fails', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const validationMessage = 'limit_unit is required for volume cap rules';

    const { rerender } = renderWithProviders(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_FOOT],
          activities: [ACTIVITY_WALK],
          rules: [],
          createRule,
          ruleMutationError: null,
        })}
        onBack={vi.fn()}
      />,
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
    await user.click(within(footSection).getByRole('button', { name: /save/i }));

    expect(createRule).toHaveBeenCalledTimes(1);

    rerender(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_FOOT],
          activities: [ACTIVITY_WALK],
          rules: [],
          createRule,
          ruleMutationError: validationMessage,
        })}
        onBack={vi.fn()}
      />,
    );

    expect(
      within(footSection).getByRole('alert'),
    ).toHaveTextContent(/limit_unit is required/i);
    expect(
      within(footSection).getByRole('button', { name: /save/i }),
    ).toBeInTheDocument();
  });

  it('clears inline error and calls clearRuleMutationError when add form is cancelled', async () => {
    const user = userEvent.setup();
    const clearRuleMutationError = vi.fn();

    renderWithProviders(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_RUNNING],
          rules: [],
          clearRuleMutationError,
          ruleMutationError: 'Rule already exists',
        })}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add class cap/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/rule already exists/i);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(clearRuleMutationError).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  });

  it('clears inline error after a successful createRule retry', async () => {
    const user = userEvent.setup();
    const createRule = vi.fn();
    const clearRuleMutationError = vi.fn();

    const { rerender } = renderWithProviders(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_RUNNING],
          rules: [],
          createRule,
          clearRuleMutationError,
          ruleMutationError: 'Rule already exists',
        })}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /add class cap/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/rule already exists/i);

    rerender(
      <EditBlockRulesScreen
        engine={makeEngine({
          block: ACTIVE_BLOCK,
          activityClasses: [CLASS_RUNNING],
          rules: [
            {
              id: 'rule-new-rest',
              trainingBlockId: ACTIVE_BLOCK.id,
              activityClassId: CLASS_RUNNING.id,
              ruleType: 'rest_between_class',
              thresholdValue: 2,
              windowDays: 7,
              enabled: true,
              createdAt: '2026-06-06T00:00:00Z',
            } satisfies Rule,
          ],
          createRule,
          clearRuleMutationError,
          ruleMutationError: null,
        })}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/minimum days between sessions/i)).toBeInTheDocument();
  });
});
