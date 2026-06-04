import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActivityManagerScreen } from './ActivityManagerScreen';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine } from '../../test/mockEngine';
import type { Activity, ActivityClass } from '../../types';
import type { MilestoneEngineResult, NewActivityDraft } from '../../hooks/useMilestoneEngine';

const CLASS_RUNNING: ActivityClass = {
  id: 'cls-running',
  userId: 'user-1',
  name: 'Running',
  type: 'performance',
  defaultRecoveryWindowDays: 2,
  createdAt: '2026-01-01T00:00:00Z',
};

const CLASS_MOBILITY: ActivityClass = {
  id: 'cls-mobility',
  userId: 'user-1',
  name: 'Mobility',
  type: 'recovery',
  defaultRecoveryWindowDays: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_MOBILITY: Activity = {
  id: 'act-mobility-1',
  userId: 'user-1',
  activityClassId: CLASS_MOBILITY.id,
  name: 'Stretching',
  type: 'recovery',
  defaultVolumeUnit: 'minutes',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const ACTIVITY_NO_CLASS: Activity = {
  ...ACTIVITY_MOBILITY,
  id: 'act-no-class-1',
  activityClassId: '',
  name: 'Untitled Activity',
};

function makeEngine(overrides: Partial<MilestoneEngineResult> = {}): MilestoneEngineResult {
  const updateActivity = vi.fn<(activityId: string, patch: Partial<NewActivityDraft>) => void>();
  const deactivateActivity = vi.fn<(activityId: string) => void>();

  return {
    ...mockEngine,
    activityClasses: [CLASS_RUNNING, CLASS_MOBILITY],
    updateActivity,
    deactivateActivity,
    ...overrides,
  };
}

function renderScreen(options: {
  activity?: Activity;
  engine?: Partial<MilestoneEngineResult>;
  onBack?: () => void;
  onComplete?: () => void;
} = {}) {
  const activity = options.activity ?? ACTIVITY_MOBILITY;
  const onBack = options.onBack ?? vi.fn();
  const onComplete = options.onComplete ?? vi.fn();
  const engine = makeEngine(options.engine);

  renderWithProviders(
    <ActivityManagerScreen
      activity={activity}
      engine={engine}
      onBack={onBack}
      onComplete={onComplete}
    />,
  );

  return { engine, onBack, onComplete };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ActivityManagerScreen', () => {
  it('prefills the form from the activity prop and shows the production volume-unit labels', () => {
    renderScreen();

    expect(screen.getByDisplayValue('Stretching')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mobility/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: /recovery/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'minutes' })).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByRole('button', { name: 'km' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'miles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'minutes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sessions' })).toBeInTheDocument();
  });

  it('keeps Save disabled until the name is present and a class is selected', async () => {
    const user = userEvent.setup();

    renderScreen();

    const nameInput = screen.getByLabelText('Activity name');
    await user.clear(nameInput);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    cleanup();
    renderScreen({ activity: ACTIVITY_NO_CLASS });
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('calls engine.updateActivity with the production patch shape and then onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const engine = makeEngine();

    renderWithProviders(
      <ActivityManagerScreen
        activity={ACTIVITY_MOBILITY}
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    const nameInput = screen.getByLabelText('Activity name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Evening mobility');
    await user.click(screen.getByRole('button', { name: /running/i }));
    await user.click(screen.getByRole('radio', { name: /performance/i }));
    await user.click(screen.getByRole('button', { name: 'km' }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(engine.updateActivity).toHaveBeenCalledTimes(1);
    expect(engine.updateActivity).toHaveBeenCalledWith(ACTIVITY_MOBILITY.id, {
      name: 'Evening mobility',
      activityClassId: CLASS_RUNNING.id,
      type: 'performance',
      defaultVolumeUnit: 'km',
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses the two-step deactivate confirm and cancels without mutating', async () => {
    const user = userEvent.setup();
    const engine = makeEngine();

    renderScreen({ engine });

    await user.click(screen.getByRole('button', { name: /deactivate activity/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.queryByText(/deactivating hides this activity from the log picker/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    expect(engine.deactivateActivity).not.toHaveBeenCalled();
  });

  it('confirms deactivation by calling engine.deactivateActivity and onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const engine = makeEngine();

    renderScreen({ engine, onComplete });

    await user.click(screen.getByRole('button', { name: /deactivate activity/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(engine.deactivateActivity).toHaveBeenCalledTimes(1);
    expect(engine.deactivateActivity).toHaveBeenCalledWith(ACTIVITY_MOBILITY.id);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    renderScreen({ onBack });

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// F10.9 — Stack screen loading and error polish
// ---------------------------------------------------------------------------

describe('ActivityManagerScreen — F10.9 loading and error polish', () => {
  it('shows a loading skeleton while engine.isInitialLoading is true', () => {
    renderScreen({ engine: { isInitialLoading: true } });

    const loading = screen.getByTestId('stack-screen-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelector('.skeleton')).not.toBeNull();
  });

  it('hides the activity form while engine.isInitialLoading is true', () => {
    renderScreen({ engine: { isInitialLoading: true } });

    expect(screen.queryByLabelText('Activity name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('shows an actionable error with Retry when engine.isFatalError is true', () => {
    renderScreen({ engine: { isFatalError: true } });

    expect(screen.getByTestId('stack-screen-error')).toHaveAttribute('role', 'alert');
    expect(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it('calls engine.refetchAll when Retry is pressed on a fatal error', async () => {
    const user = userEvent.setup();
    const refetchAll = vi.fn();
    renderScreen({ engine: { isFatalError: true, refetchAll } });

    await user.click(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    );

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('does not use viewport-height layout on the screen root', () => {
    renderScreen();

    const root = screen.getByRole('heading', { name: /edit activity/i }).closest('section');
    expect(root).not.toBeNull();
    expect(root).not.toHaveClass('h-screen', 'min-h-screen');
    expect(root?.getAttribute('style') ?? '').not.toMatch(/100vh/i);
  });
});
