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
