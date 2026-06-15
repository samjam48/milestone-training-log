/**
 * C6.2 — Log form decimal volume acceptance tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  createLogActivityEngine,
  logActivityClass,
  logActivityWalk,
} from '../../test/fixtures/c62Fixtures';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { Activity } from '../../types';
import { LogActivityScreen } from './LogActivityScreen';

interface LogActivityScreenS28Props {
  engine: MilestoneEngineResult;
  initialActivityId?: string;
  logId?: string;
  onBack: () => void;
  onComplete: () => void;
  onCreateActivity?: () => void;
}

const LogActivityScreenS28 = LogActivityScreen as unknown as (
  props: LogActivityScreenS28Props,
) => JSX.Element;

function getVolumeInput(): HTMLInputElement {
  const volumeLabel = screen.getByText('Volume');
  const volumeField = volumeLabel.parentElement;
  expect(volumeField).not.toBeNull();
  return within(volumeField!).getByRole('spinbutton');
}

describe('LogActivityScreen volume decimals (C6.2)', () => {
  afterEach(() => {
    cleanup();
  });

  it('sets step="any" on the volume NumberField so decimal km values pass native validation', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine();

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(getVolumeInput()).toHaveAttribute('step', 'any');
  });

  it('passes native validation for decimal volume values such as 1.5 km', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine();

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const volumeInput = getVolumeInput();
    await user.clear(volumeInput);
    await user.type(volumeInput, '1.5');

    expect(volumeInput).toHaveValue(1.5);
    expect(volumeInput.validity.stepMismatch).toBe(false);
    expect(volumeInput.checkValidity()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S2.8 — Log Activity empty state (plans/tickets-stage-2-polish-2026-06-05.md)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — S2.8 empty state (no active activities)', () => {
  afterEach(() => {
    cleanup();
  });

  function renderLogActivity(
    engine: MilestoneEngineResult,
    props: Partial<Omit<LogActivityScreenS28Props, 'engine'>> = {},
  ): void {
    renderWithProviders(
      <LogActivityScreenS28
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        {...props}
      />,
    );
  }

  it('shows log-activity-empty-state when activities is empty', () => {
    renderLogActivity(createLogActivityEngine({ activities: [] }));

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no activities yet/i)).toBeInTheDocument();
  });

  it('shows Create activity CTA in the empty state', () => {
    renderLogActivity(createLogActivityEngine({ activities: [] }));

    expect(
      screen.getByRole('button', { name: /create activity/i }),
    ).toBeInTheDocument();
  });

  it('calls onCreateActivity when Create activity CTA is clicked', async () => {
    const user = userEvent.setup();
    const onCreateActivity = vi.fn();
    renderLogActivity(createLogActivityEngine({ activities: [] }), { onCreateActivity });

    await user.click(screen.getByRole('button', { name: /create activity/i }));

    expect(onCreateActivity).toHaveBeenCalledTimes(1);
  });

  it('does not show session details or activity picker rows when empty', () => {
    renderLogActivity(createLogActivityEngine({ activities: [] }));

    expect(screen.queryByText('Session details')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Morning Walk' })).not.toBeInTheDocument();
  });

  it('shows empty state when all catalog activities are inactive', () => {
    renderLogActivity(
      createLogActivityEngine({
        activities: [{ ...logActivityWalk, isActive: false }],
      }),
    );

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Morning Walk' })).not.toBeInTheDocument();
  });

  it('ignores initialActivityId when the activity id is not in the catalog', () => {
    renderLogActivity(createLogActivityEngine({ activities: [] }), {
      initialActivityId: 'act-missing',
    });

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Session details')).not.toBeInTheDocument();
  });

  it('ignores initialActivityId when the activity is inactive', () => {
    renderLogActivity(
      createLogActivityEngine({
        activities: [{ ...logActivityWalk, isActive: false }],
      }),
      { initialActivityId: logActivityWalk.id },
    );

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('Session details')).not.toBeInTheDocument();
  });

  it('does not show empty state when active activities exist', () => {
    renderLogActivity(createLogActivityEngine());

    expect(screen.queryByTestId('log-activity-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText('What did you do?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Morning Walk' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// S25.F3 — Log date picker (plans/tickets-stage-2-5-usage-logic-2026-06-06.md)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — S25.F3 log date picker', () => {
  afterEach(() => {
    cleanup();
  });

  const TODAY = '2026-05-28';
  const YESTERDAY = '2026-05-27';
  const TOMORROW = '2026-05-29';

  async function selectWalkAndOpenDetails(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
  }

  async function fillMinimumSession(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    const durationLabel = screen.getByText('Duration');
    const durationField = durationLabel.parentElement;
    expect(durationField).not.toBeNull();
    const durationInput = within(durationField!).getByRole('spinbutton');
    await user.clear(durationInput);
    await user.type(durationInput, '20');
  }

  it('defaults the date field to Today', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await selectWalkAndOpenDetails(user);

    expect(screen.getByTestId('log-date-field')).toHaveTextContent('Today');
  });

  it('submits a past loggedDate from the date picker in the LogDraft', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn();
    const engine = createLogActivityEngine({ todayDate: TODAY, submitLog });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await selectWalkAndOpenDetails(user);
    await user.click(screen.getByTestId('log-date-field'));
    await user.click(screen.getByTestId(`date-picker-day-${YESTERDAY}`));
    await fillMinimumSession(user);
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    expect(submitLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: logActivityWalk.id,
        loggedDate: YESTERDAY,
        durationMinutes: 20,
      }),
    );
  });

  it('checks rule warnings against the selected log date', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);
    const engine = createLogActivityEngine({
      todayDate: TODAY,
      checkViolations,
    });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await selectWalkAndOpenDetails(user);
    await user.click(screen.getByTestId('log-date-field'));
    await user.click(screen.getByTestId(`date-picker-day-${YESTERDAY}`));
    await fillMinimumSession(user);

    expect(checkViolations).toHaveBeenLastCalledWith(
      logActivityWalk.id,
      0,
      5,
      20,
      'km',
      YESTERDAY,
    );
  });

  it('does not allow selecting a future date in the picker', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine({ todayDate: TODAY });

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await selectWalkAndOpenDetails(user);
    await user.click(screen.getByTestId('log-date-field'));

    const tomorrowButton = screen.getByTestId(`date-picker-day-${TOMORROW}`);
    expect(tomorrowButton).toBeDisabled();
    expect(tomorrowButton).toHaveAttribute('aria-disabled', 'true');
  });
});

// ---------------------------------------------------------------------------
// S25.F4 — Edit log flow (plans/tickets-stage-2-5-usage-logic-2026-06-06.md)
// ---------------------------------------------------------------------------

describe('LogActivityScreen — S25.F4 edit log', () => {
  afterEach(() => {
    cleanup();
  });

  const TODAY = '2026-05-28';
  const YESTERDAY = '2026-05-27';

  it('prefills the edit form from the existing log and calls updateLog on save', async () => {
    const user = userEvent.setup();
    const updateLog = vi.fn();
    const existingLog = {
      id: 'log-edit-1',
      userId: 'user-1',
      activityId: logActivityWalk.id,
      loggedDate: TODAY,
      durationMinutes: 25,
      volumeValue: 2,
      volumeUnit: 'km' as const,
      rpe: 4 as const,
      postActivityFeel: 'fine' as const,
      notes: 'Easy',
      createdAt: '2026-04-07T06:00:00Z',
    };

    const engine = createLogActivityEngine({
      todayDate: TODAY,
      logs: [existingLog],
      updateLog,
    });

    renderWithProviders(
      <LogActivityScreen
        engine={engine}
        logId={existingLog.id}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Activity' })).toBeInTheDocument();
    expect(screen.getByTestId('log-date-field')).toHaveTextContent('Today');

    await user.click(screen.getByTestId('log-date-field'));
    await user.click(screen.getByTestId(`date-picker-day-${YESTERDAY}`));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateLog).toHaveBeenCalledWith(
      existingLog.id,
      expect.objectContaining({
        activityId: logActivityWalk.id,
        loggedDate: YESTERDAY,
        durationMinutes: 25,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// D3 — Await API success before success UI / navigation
// ---------------------------------------------------------------------------

describe('LogActivityScreen — D3 async save', () => {
  afterEach(() => {
    cleanup();
  });

  const TODAY = '2026-05-28';

  async function submitCreateLog(
    user: ReturnType<typeof userEvent.setup>,
    submitLog: ReturnType<typeof vi.fn>,
  ): Promise<void> {
    const engine = createLogActivityEngine({ todayDate: TODAY, submitLog });
    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '20');
    await user.click(screen.getByRole('button', { name: 'Log session' }));
  }

  it('shows a loading overlay while submitLog is in flight', async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    const submitLog = vi.fn(
      () => new Promise<void>(resolve => { resolveSubmit = resolve; }),
    );

    await submitCreateLog(user, submitLog);

    expect(screen.getByTestId('log-activity-saving')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Logging session' })).toBeInTheDocument();

    resolveSubmit();
    await waitFor(() => {
      expect(screen.queryByTestId('log-activity-saving')).not.toBeInTheDocument();
    });
  });

  it('does not show success UI until submitLog resolves', async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    const submitLog = vi.fn(
      () => new Promise<void>(resolve => { resolveSubmit = resolve; }),
    );

    await submitCreateLog(user, submitLog);

    expect(screen.queryByText('Session logged.')).not.toBeInTheDocument();

    resolveSubmit();
    await waitFor(() => {
      expect(screen.getByText('Session logged.')).toBeInTheDocument();
    });
  });

  it('surfaces API errors and stays on the form without calling onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { ApiError } = await import('../../lib/api/client');
    const submitLog = vi.fn().mockRejectedValue(new ApiError(500, 'Server error'));

    const engine = createLogActivityEngine({ todayDate: TODAY, submitLog });
    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={onComplete} />,
    );
    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '20');
    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
    expect(screen.getByRole('heading', { name: 'Log Activity' })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UX-B7 — Log Activity picker collapse after selection
// ---------------------------------------------------------------------------

describe('LogActivityScreen — UX-B7 activity picker collapse', () => {
  afterEach(() => {
    cleanup();
  });

  const bikeActivity: Activity = {
    ...logActivityWalk,
    id: 'act-bike',
    name: 'Stationary Bike',
    defaultVolumeUnit: 'minutes',
  };

  function renderLogActivity(
    engine: MilestoneEngineResult = createLogActivityEngine(),
    props: Partial<LogActivityScreenS28Props> = {},
  ): void {
    renderWithProviders(
      <LogActivityScreenS28
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
        {...props}
      />,
    );
  }

  function expectCollapsedActivitySummary(activity: Activity): void {
    expect(screen.getByText(logActivityClass.name)).toBeInTheDocument();
    expect(screen.getByText(activity.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^change$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: activity.name })).not.toBeInTheDocument();
  }

  function expectSessionDetailsVisible(): void {
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Session details')).toBeInTheDocument();
    expect(screen.getByText('Effort (RPE)')).toBeInTheDocument();
    expect(screen.getByText('How did it go?')).toBeInTheDocument();
  }

  function getLastViolationCheck(
    checkViolations: ReturnType<typeof vi.fn>,
  ): unknown[] {
    expect(checkViolations).toHaveBeenCalled();
    const lastCall = checkViolations.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    return lastCall!;
  }

  it('collapses the full picker to class and exercise summary after selecting an exercise', async () => {
    const user = userEvent.setup();
    renderLogActivity();

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expectCollapsedActivitySummary(logActivityWalk);
    expectSessionDetailsVisible();
  });

  it('re-expands the grouped picker when Change is activated', async () => {
    const user = userEvent.setup();
    renderLogActivity();

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));
    await user.click(screen.getByRole('button', { name: /^change$/i }));

    expect(screen.getByText('What did you do?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Morning Walk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^change$/i })).not.toBeInTheDocument();
  });

  it('starts collapsed when initialActivityId points to an active activity', () => {
    renderLogActivity(createLogActivityEngine(), {
      initialActivityId: logActivityWalk.id,
    });

    expectCollapsedActivitySummary(logActivityWalk);
    expectSessionDetailsVisible();
  });

  it('starts collapsed in edit mode for an existing log', () => {
    const existingLog = {
      id: 'log-edit-collapse',
      userId: 'user-1',
      activityId: logActivityWalk.id,
      loggedDate: '2026-05-28',
      durationMinutes: 25,
      volumeValue: 2,
      volumeUnit: 'km' as const,
      rpe: 4 as const,
      postActivityFeel: 'fine' as const,
      notes: 'Easy',
      createdAt: '2026-04-07T06:00:00Z',
    };

    renderLogActivity(createLogActivityEngine({ logs: [existingLog] }), {
      logId: existingLog.id,
    });

    expectCollapsedActivitySummary(logActivityWalk);
    expectSessionDetailsVisible();
  });

  it('checks live violations with duration as volume for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        checkViolations,
      }),
      { initialActivityId: bikeActivity.id },
    );

    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '45');

    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    expect(getLastViolationCheck(checkViolations)).toEqual([
      bikeActivity.id,
      45,
      5,
      45,
      'minutes',
      '2026-05-28',
    ]);
  });

  it('submits duration as minutes volume for a minute-unit activity', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn().mockResolvedValue(undefined);

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        submitLog,
      }),
      { initialActivityId: bikeActivity.id },
    );

    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '45');

    expect(screen.queryByText('Volume')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => expect(submitLog).toHaveBeenCalledTimes(1));
    expect(submitLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: bikeActivity.id,
        durationMinutes: 45,
        volumeValue: 45,
        volumeUnit: 'minutes',
      }),
    );
  });

  it('checks live violations with duration as volume when editing a minute-unit log', async () => {
    const checkViolations = vi.fn().mockReturnValue([]);
    const existingLog = {
      id: 'log-edit-minute-collapse',
      userId: 'user-1',
      activityId: bikeActivity.id,
      loggedDate: '2026-05-28',
      durationMinutes: 25,
      volumeValue: 25,
      volumeUnit: 'minutes' as const,
      rpe: 4 as const,
      postActivityFeel: 'fine' as const,
      notes: 'Easy',
      createdAt: '2026-04-07T06:00:00Z',
    };

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        logs: [existingLog],
        checkViolations,
      }),
      { logId: existingLog.id },
    );

    const durationInput = screen.getByPlaceholderText('20');
    fireEvent.change(durationInput, { target: { value: '30' } });

    expect(getLastViolationCheck(checkViolations)).toEqual([
      bikeActivity.id,
      30,
      4,
      30,
      'minutes',
      '2026-05-28',
    ]);
  });

  it('saves duration as minutes volume when editing a minute-unit log', async () => {
    const updateLog = vi.fn().mockResolvedValue(undefined);
    const existingLog = {
      id: 'log-edit-minute-collapse',
      userId: 'user-1',
      activityId: bikeActivity.id,
      loggedDate: '2026-05-28',
      durationMinutes: 25,
      volumeValue: 25,
      volumeUnit: 'minutes' as const,
      rpe: 4 as const,
      postActivityFeel: 'fine' as const,
      notes: 'Easy',
      createdAt: '2026-04-07T06:00:00Z',
    };

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        logs: [existingLog],
        updateLog,
      }),
      { logId: existingLog.id },
    );

    const durationInput = screen.getByPlaceholderText('20');
    fireEvent.change(durationInput, { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateLog).toHaveBeenCalledTimes(1));
    expect(updateLog).toHaveBeenCalledWith(
      existingLog.id,
      expect.objectContaining({
        activityId: bikeActivity.id,
        durationMinutes: 30,
        volumeValue: 30,
        volumeUnit: 'minutes',
      }),
    );
  });

  it('keeps the picker expanded when initialActivityId is missing or inactive', () => {
    renderLogActivity(createLogActivityEngine(), {
      initialActivityId: 'act-missing',
    });

    expect(screen.getByText('What did you do?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Morning Walk' })).toBeInTheDocument();
    expect(screen.queryByText('Session details')).not.toBeInTheDocument();

    cleanup();

    renderLogActivity(
      createLogActivityEngine({
        activities: [
          { ...logActivityWalk, isActive: false },
          bikeActivity,
        ],
      }),
      { initialActivityId: logActivityWalk.id },
    );

    expect(screen.getByText('What did you do?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Morning Walk' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stationary Bike' })).toBeInTheDocument();
    expect(screen.queryByText('Session details')).not.toBeInTheDocument();
  });

  it('keeps entered session details and checks live violations with derived minute volume after changing to a minute-unit exercise', async () => {
    const user = userEvent.setup();
    const checkViolations = vi.fn().mockReturnValue([]);

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        checkViolations,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '35');

    const rpeSlider = screen.getByRole('slider');
    fireEvent.change(rpeSlider, { target: { value: '8' } });

    await user.click(screen.getByRole('radio', { name: 'Bad' }));
    await user.click(screen.getByRole('button', { name: /^change$/i }));
    await user.click(screen.getByRole('button', { name: 'Stationary Bike' }));

    expectCollapsedActivitySummary(bikeActivity);
    expect(screen.getByPlaceholderText('20')).toHaveValue(35);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '8');
    expect(screen.getByRole('radio', { name: 'Bad' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    expect(getLastViolationCheck(checkViolations)).toEqual([
      bikeActivity.id,
      35,
      8,
      35,
      'minutes',
      '2026-05-28',
    ]);
  });

  it('keeps entered session details and submits derived minute volume after changing to a minute-unit exercise', async () => {
    const user = userEvent.setup();
    const submitLog = vi.fn().mockResolvedValue(undefined);

    renderLogActivity(
      createLogActivityEngine({
        activities: [logActivityWalk, bikeActivity],
        submitLog,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const durationInput = screen.getByPlaceholderText('20');
    await user.clear(durationInput);
    await user.type(durationInput, '35');

    const rpeSlider = screen.getByRole('slider');
    fireEvent.change(rpeSlider, { target: { value: '8' } });

    await user.click(screen.getByRole('radio', { name: 'Bad' }));
    await user.click(screen.getByRole('button', { name: /^change$/i }));
    await user.click(screen.getByRole('button', { name: 'Stationary Bike' }));

    expectCollapsedActivitySummary(bikeActivity);
    expect(screen.getByPlaceholderText('20')).toHaveValue(35);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '8');
    expect(screen.getByRole('radio', { name: 'Bad' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log session' }));

    await waitFor(() => expect(submitLog).toHaveBeenCalledTimes(1));
    expect(submitLog).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: bikeActivity.id,
        durationMinutes: 35,
        volumeValue: 35,
        volumeUnit: 'minutes',
        rpe: 8,
        postActivityFeel: 'bad',
      }),
    );
  });

  it('leaves the existing no-active-activities empty state path unchanged', () => {
    renderLogActivity(createLogActivityEngine({ activities: [] }));

    expect(screen.getByTestId('log-activity-empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^change$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Session details')).not.toBeInTheDocument();
  });
});
