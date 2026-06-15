/**
 * Log Activity: hide volume field when defaultVolumeUnit is 'minutes'
 *
 * Acceptance criteria:
 *   AC1  Volume field hidden for minute-unit activity (create mode)
 *   AC2  Volume field visible for non-minute activity (km) — unaffected
 *   AC3  Submit of minute-unit log sends duration-derived minutes volume
 *   AC4  Edit mode with minute-unit activity: Volume field absent even when
 *         existing log has a non-zero volumeValue
 *   AC5  checkViolations still fires for minute-unit activities (duration-based
 *         rules keep evaluating)
 *   AC6  Non-minute activities (km, sessions, etc.) are completely unaffected
 *
 * Token confirmed: VolumeUnit for minutes is 'minutes' (types.ts:67)
 * Guard target: LogActivityScreen.tsx:322 — {selAct?.defaultVolumeUnit && ...}
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  createLogActivityEngine,
  logActivityClass,
} from '../../test/fixtures/c62Fixtures';
import { mockEngine } from '../../test/mockEngine';
import type { Activity, ActivityClass, ActivityLog } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { LogActivityScreen } from './LogActivityScreen';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATED_AT = '2026-04-07T06:00:00Z';
const USER_ID = 'user-1';
const TODAY = '2026-05-28';

/** Activity class shared by minute-unit activities. */
const minuteClass: ActivityClass = {
  id: 'cls-mobility',
  userId: USER_ID,
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: CREATED_AT,
};

/** Activity whose defaultVolumeUnit is 'minutes' — the unit under test. */
const minuteActivity: Activity = {
  id: 'act-stretch',
  userId: USER_ID,
  activityClassId: minuteClass.id,
  name: 'Stretching',
  type: 'recovery',
  defaultVolumeUnit: 'minutes',
  isActive: true,
  createdAt: CREATED_AT,
};

/** Activity whose defaultVolumeUnit is 'sessions' — another non-minute unit. */
const sessionsActivity: Activity = {
  id: 'act-gym',
  userId: USER_ID,
  activityClassId: logActivityClass.id,
  name: 'Gym Session',
  type: 'performance',
  defaultVolumeUnit: 'sessions',
  isActive: true,
  createdAt: CREATED_AT,
};

function createMinuteEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return {
    ...mockEngine,
    todayDate: TODAY,
    activityClasses: [minuteClass],
    activities: [minuteActivity],
    ...overrides,
  };
}

function createKmEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return createLogActivityEngine({ todayDate: TODAY, ...overrides });
}

/** Fill the duration field (required for submit). */
async function fillDuration(
  user: ReturnType<typeof userEvent.setup>,
  value = '30',
): Promise<void> {
  const input = screen.getByPlaceholderText('20');
  await user.clear(input);
  await user.type(input, value);
}

// ---------------------------------------------------------------------------
// AC1 — Volume field hidden for minute-unit activity (create mode)
// ---------------------------------------------------------------------------

describe('AC1 — Volume field hidden for minute-unit activity (create mode)', () => {
  afterEach(cleanup);

  it('does not render a Volume label after selecting a minute-unit activity', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LogActivityScreen engine={createMinuteEngine()} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));

    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
  });

  it('does not render a volume number input after selecting a minute-unit activity', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LogActivityScreen engine={createMinuteEngine()} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));

    // Only the duration spinbutton should be present
    const spinbuttons = screen.getAllByRole('spinbutton');
    expect(spinbuttons).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Volume field visible for km activity (non-minute)
// ---------------------------------------------------------------------------

describe('AC2 — Volume field visible for non-minute activity (km)', () => {
  afterEach(cleanup);

  it('renders the Volume label after selecting a km activity', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LogActivityScreen engine={createKmEngine()} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('renders two spinbuttons (duration + volume) for a km activity', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LogActivityScreen engine={createKmEngine()} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Submit of minute-unit log sends duration-derived minutes volume
// ---------------------------------------------------------------------------

describe('AC3 — Submit minute-unit log uses duration-derived minutes volume', () => {
  afterEach(cleanup);

  it('submits duration minutes as volumeValue for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ submitLog })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));
    await fillDuration(user);
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => expect(submitLog).toHaveBeenCalledTimes(1));

    const draft = submitLog.mock.calls[0]![0];
    expect(draft.volumeValue).toBe(30);
    expect(draft.volumeUnit).toBe('minutes');
  });

  it('keeps durationMinutes and volumeValue aligned for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ submitLog })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));
    await fillDuration(user);
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => expect(submitLog).toHaveBeenCalledTimes(1));

    const draft = submitLog.mock.calls[0]![0];
    expect(draft.durationMinutes).toBe(30);
    expect(draft.volumeValue).toBe(30);
    expect(draft.volumeUnit).toBe('minutes');
  });
});

// ---------------------------------------------------------------------------
// AC4 — Edit mode: Volume field absent even when existing log has non-zero volumeValue
// ---------------------------------------------------------------------------

describe('AC4 — Edit mode: Volume field absent for minute-unit activity', () => {
  afterEach(cleanup);

  const existingMinuteLog: ActivityLog = {
    id: 'log-minute-1',
    userId: USER_ID,
    activityId: minuteActivity.id,
    loggedDate: TODAY,
    durationMinutes: 30,
    volumeValue: 30,
    volumeUnit: 'minutes' as const,
    rpe: 5 as const,
    postActivityFeel: 'fine' as const,
    createdAt: CREATED_AT,
  };

  it('does not render Volume label in edit mode for a minute-unit activity', () => {
    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ logs: [existingMinuteLog] })}
        logId={existingMinuteLog.id}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
  });

  it('does not render a volume spinbutton in edit mode for a minute-unit activity', () => {
    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ logs: [existingMinuteLog] })}
        logId={existingMinuteLog.id}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    // Only the duration spinbutton should be visible
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });

  it('saves duration minutes as volumeValue when saving a minute-unit edit', async () => {
    const user = userEvent.setup();
    const updateLog = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ logs: [existingMinuteLog], updateLog })}
        logId={existingMinuteLog.id}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateLog).toHaveBeenCalledTimes(1));

    const patch = updateLog.mock.calls[0]![1];
    expect(patch.durationMinutes).toBe(30);
    expect(patch.volumeValue).toBe(30);
    expect(patch.volumeUnit).toBe('minutes');
  });
});

// ---------------------------------------------------------------------------
// AC5 — checkViolations still fires for minute-unit activities
// ---------------------------------------------------------------------------

describe('AC5 — checkViolations fires for minute-unit activities', () => {
  afterEach(cleanup);

  it('calls checkViolations when duration is entered for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);

    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ checkViolations })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));
    await fillDuration(user, '30');

    expect(checkViolations).toHaveBeenCalled();
  });

  it('passes the activityId and duration to checkViolations for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);

    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ checkViolations })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));
    await fillDuration(user, '30');

    const calls = checkViolations.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1]!;
    // checkViolations(activityId, volume, rpe, duration, unit, date)
    expect(lastCall[0]).toBe(minuteActivity.id);
    expect(lastCall[3]).toBe(30); // duration
  });

  it('passes duration minutes as volume to checkViolations for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);

    renderWithProviders(
      <LogActivityScreen
        engine={createMinuteEngine({ checkViolations })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Stretching' }));
    await fillDuration(user, '30');

    const calls = checkViolations.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    // volume arg (index 1) uses duration-derived minutes for minute-unit rules
    expect(lastCall[1]).toBe(30);
    expect(lastCall[4]).toBe('minutes');
  });
});

// ---------------------------------------------------------------------------
// AC6 — Non-minute activities are completely unaffected
// ---------------------------------------------------------------------------

describe('AC6 — Non-minute activities unaffected', () => {
  afterEach(cleanup);

  it('shows Volume field for a sessions-unit activity', async () => {
    const user = userEvent.setup();
    const engine: MilestoneEngineResult = {
      ...mockEngine,
      todayDate: TODAY,
      activityClasses: [logActivityClass],
      activities: [sessionsActivity],
    };

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Gym Session' }));

    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('shows Volume field for km activity (regression guard)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LogActivityScreen engine={createKmEngine()} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(screen.getByText('Volume')).toBeInTheDocument();
  });

  it('volume input accepts and submits a non-zero value for a km activity', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <LogActivityScreen
        engine={createKmEngine({ submitLog })}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    await fillDuration(user, '45');

    const volumeInput = screen.getAllByRole('spinbutton')[1]!;
    await user.clear(volumeInput);
    await user.type(volumeInput, '5');

    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => expect(submitLog).toHaveBeenCalledTimes(1));

    const draft = submitLog.mock.calls[0]![0];
    expect(draft.volumeValue).toBe(5);
  });

  it('does not hide Volume for an activity with no defaultVolumeUnit set', async () => {
    const user = userEvent.setup();
    const noUnitActivity: Activity = {
      id: 'act-no-unit',
      userId: USER_ID,
      activityClassId: logActivityClass.id,
      name: 'Free Form',
      type: 'performance',
      // defaultVolumeUnit deliberately omitted
      isActive: true,
      createdAt: CREATED_AT,
    };

    const engine: MilestoneEngineResult = {
      ...mockEngine,
      todayDate: TODAY,
      activityClasses: [logActivityClass],
      activities: [noUnitActivity],
    };

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Free Form' }));

    // No volume unit → block doesn't render (existing behaviour, not broken by the guard)
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
  });
});
