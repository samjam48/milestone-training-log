/**
 * F9.10 — InlineLogSheet quick-log acceptance tests.
 *
 * These tests exercise the public behaviour the Dashboard needs for the new
 * quick-log bottom sheet. The production sheet is not implemented yet, so the
 * current app should fail these assertions by opening the full LogActivityScreen
 * instead of a modal sheet.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { renderWithProviders } from '../../test/renderWithProviders';
import { expectSafeBottomOnlyInset } from '../../test/bottomInsetLayout';
import {
  applyC63DashboardFixtures,
  c63SafeStretchSuggestion,
  c63StretchActivity,
  c63YogaActivity,
  mockEngine,
  resetMockEngine,
} from '../../test/mockEngine';
import type { LogDraft } from '../../hooks/useMilestoneEngine';
import type { Suggestion } from '../../lib/engine';
import type { Activity } from '../../types';
import type { RuleViolationSnapshot } from '../../types';

vi.mock('../../hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

function renderApp(): void {
  renderWithProviders(<App />);
}

function expectQuickLogSheet(activityName: string): void {
  expect(
    screen.getByRole('dialog', { name: new RegExp(`Quick log — ${activityName}`, 'i') }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: new RegExp(`^${activityName}$`, 'i') }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Decrease' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Increase' })).toBeInTheDocument();
  expect(screen.getByRole('slider')).toBeInTheDocument();
  expect(
    screen.getByRole('radiogroup', { name: 'Post-activity feel' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log session' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
}

const c63WalkActivity: Activity = {
  id: 'act-walk',
  userId: 'user-1',
  activityClassId: 'cls-mobility',
  name: 'Walking',
  type: 'performance',
  defaultVolumeUnit: 'km',
  isActive: true,
  createdAt: '2026-04-07T06:00:00Z',
};

const c63WalkSuggestion: Suggestion = {
  id: c63WalkActivity.id,
  label: 'Walking',
  state: 'safe',
  reason: 'Within recovery window.',
};

const c63BandsActivity: Activity = {
  id: 'act-bands',
  userId: 'user-1',
  activityClassId: 'cls-mobility',
  name: 'Bands',
  type: 'performance',
  defaultVolumeUnit: 'sets',
  isActive: true,
  createdAt: '2026-04-07T06:00:00Z',
};

const c63BandsSuggestion: Suggestion = {
  id: c63BandsActivity.id,
  label: 'Bands',
  state: 'safe',
  reason: 'Within recovery window.',
};

describe('InlineLogSheet quick-log contract (F9.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockEngine();
    applyC63DashboardFixtures({
      suggestions: [c63SafeStretchSuggestion],
      activities: [c63StretchActivity, c63YogaActivity],
    });
    mockEngine.submitLog = vi.fn();
    mockEngine.checkViolations = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the quick-log sheet from a dashboard suggestion instead of the full LogActivityScreen', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expectQuickLogSheet('Stretching');
  });

  it('submits a production LogDraft and closes the sheet', async () => {
    const user = userEvent.setup();
    const submitLog = vi.mocked(mockEngine.submitLog);
    mockEngine.submitLog = submitLog;

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');

    await user.click(screen.getByRole('button', { name: 'Log session' }));

    const expectedDraft: LogDraft = {
      activityId: c63StretchActivity.id,
      loggedDate: mockEngine.todayDate,
      durationMinutes: 20,
      volumeValue: 20,
      volumeUnit: c63StretchActivity.defaultVolumeUnit,
      rpe: 5,
      postActivityFeel: 'fine',
    };

    expect(submitLog).toHaveBeenCalledWith(expectedDraft);
    expect(screen.queryByRole('dialog', { name: /quick log/i })).not.toBeInTheDocument();
  });

  it('uses a km default volume of 1 instead of 20 on quick log submit', async () => {
    const user = userEvent.setup();
    const submitLog = vi.mocked(mockEngine.submitLog);
    mockEngine.submitLog = submitLog;

    applyC63DashboardFixtures({
      suggestions: [c63WalkSuggestion],
      activities: [c63WalkActivity],
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log walking' }));
    expectQuickLogSheet('Walking');

    await user.click(screen.getByRole('button', { name: 'Log session' }));

    expect(submitLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: c63WalkActivity.id,
        volumeValue: 1,
        volumeUnit: 'km',
      }),
    );
  });

  it('increments sets volume by 1 instead of 5 on quick log submit', async () => {
    const user = userEvent.setup();
    const submitLog = vi.mocked(mockEngine.submitLog);
    mockEngine.submitLog = submitLog;

    applyC63DashboardFixtures({
      suggestions: [c63BandsSuggestion],
      activities: [c63BandsActivity],
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log bands' }));
    expectQuickLogSheet('Bands');

    await user.click(screen.getByRole('button', { name: 'Increase volume' }));
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    expect(submitLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: c63BandsActivity.id,
        volumeValue: 4,
        volumeUnit: 'sets',
      }),
    );
  });

  it('keeps submit disabled for danger violations until the user overrides', async () => {
    const user = userEvent.setup();
    const dangerViolation: RuleViolationSnapshot = {
      ruleId: 'rule-rest',
      ruleType: 'rest_between_class',
      severity: 'danger',
      message: 'Rest day required',
    };
    mockEngine.checkViolations = vi.fn().mockReturnValue([dangerViolation]);

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    expectQuickLogSheet('Stretching');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log anyway' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Log session' })).toBeDisabled();
  });

  it('does not open the sheet when the suggestion cannot be resolved to an activity', async () => {
    const user = userEvent.setup();
    applyC63DashboardFixtures({
      suggestions: [{ ...c63SafeStretchSuggestion, id: 'act-deleted' }],
      activities: [c63YogaActivity],
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));

    expect(screen.queryByRole('dialog', { name: /quick log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log Activity' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S2.1 — Sheet panel clears device safe area (edge case)
// ---------------------------------------------------------------------------

describe('InlineLogSheet — S2.1 safe-bottom on sheet panel', () => {
  beforeEach(() => {
    resetMockEngine();
    applyC63DashboardFixtures();
  });

  afterEach(() => {
    cleanup();
  });

  it('applies safe-bottom inset on the fixed quick-log sheet panel', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Log stretching' }));
    const panel = screen.getByRole('dialog', { name: /quick log — stretching/i });
    expectSafeBottomOnlyInset(panel);
  });
});
