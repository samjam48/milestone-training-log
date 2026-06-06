/**
 * C6.2 — Log form decimal volume acceptance tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  createLogActivityEngine,
  logActivityWalk,
} from '../../test/fixtures/c62Fixtures';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { LogActivityScreen } from './LogActivityScreen';

interface LogActivityScreenS28Props {
  engine: MilestoneEngineResult;
  initialActivityId?: string;
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
