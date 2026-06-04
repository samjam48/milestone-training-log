/**
 * F9.8 — NewTrainingBlockScreen component tests (failing first, TDD).
 *
 * The production screen does not exist yet; these tests are written against the
 * approved standalone screen contract and intentionally fail until the missing
 * behavior is implemented.
 *
 * Source contract: plans/tickets-phase-9-settings-flow-2026-06-03.md §F9.8
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine } from '../../test/mockEngine';
import type { TrainingBlock } from '../../types';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { NewTrainingBlockScreen } from './NewTrainingBlockScreen';

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'May Rehab Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

const EMPTY_BLOCK: TrainingBlock = {
  id: '',
  userId: 'user-1',
  name: '',
  startDate: '2026-05-01',
  endDate: undefined,
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-05-01T00:00:00Z',
};

function makeEngine(
  overrides: Partial<MilestoneEngineResult> = {},
): MilestoneEngineResult {
  return {
    ...mockEngine,
    todayDate: '2026-05-28',
    block: ACTIVE_BLOCK,
    createTrainingBlock: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NewTrainingBlockScreen', () => {
  it('renders the standalone form shell and keeps Create disabled before entry', () => {
    const engine = makeEngine();

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: /new training block/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('defaults the start date to engine.todayDate', () => {
    const engine = makeEngine({ todayDate: '2026-06-03' });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-06-03');
  });

  it('omits endDate when the field is left blank and completes after create', async () => {
    const user = userEvent.setup();
    const createTrainingBlock = vi.fn();
    const onComplete = vi.fn();
    const engine = makeEngine({ createTrainingBlock });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.type(screen.getByLabelText(/block name/i), 'June Rehab Block');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(createTrainingBlock).toHaveBeenCalledTimes(1);
    expect(createTrainingBlock).toHaveBeenCalledWith({
      name: 'June Rehab Block',
      startDate: '2026-05-28',
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('passes endDate when the field is filled before create', async () => {
    const user = userEvent.setup();
    const createTrainingBlock = vi.fn();
    const onComplete = vi.fn();
    const engine = makeEngine({ createTrainingBlock });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={onComplete}
      />,
    );

    await user.type(screen.getByLabelText(/block name/i), 'June Rehab Block');
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: '2026-05-28' },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: '2026-06-15' },
    });
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(createTrainingBlock).toHaveBeenCalledTimes(1);
    expect(createTrainingBlock).toHaveBeenCalledWith({
      name: 'June Rehab Block',
      startDate: '2026-05-28',
      endDate: '2026-06-15',
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the archive notice hidden when the current block is empty', () => {
    const engine = makeEngine({ block: EMPTY_BLOCK });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByText(/archive/i)).not.toBeInTheDocument();
  });

  it('shows the archive notice only when engine.block.id is non-empty', () => {
    const engine = makeEngine({ block: ACTIVE_BLOCK });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/archive/i);
  });

  it('calls onBack without mutating create state', async () => {
    const user = userEvent.setup();
    const createTrainingBlock = vi.fn();
    const onBack = vi.fn();
    const engine = makeEngine({ createTrainingBlock });

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={onBack}
        onComplete={vi.fn()}
      />,
    );

    const banner = screen.getByRole('banner');
    await user.click(within(banner).getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(createTrainingBlock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// F10.9 — Stack screen loading and error polish
// ---------------------------------------------------------------------------

describe('NewTrainingBlockScreen — F10.9 loading and error polish', () => {
  function renderNewBlockScreen(engineOverrides: Partial<MilestoneEngineResult> = {}) {
    const engine = makeEngine(engineOverrides);

    renderWithProviders(
      <NewTrainingBlockScreen
        engine={engine}
        onBack={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    return engine;
  }

  it('shows a loading skeleton while engine.isInitialLoading is true', () => {
    renderNewBlockScreen({ isInitialLoading: true });

    const loading = screen.getByTestId('stack-screen-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelector('.skeleton')).not.toBeNull();
  });

  it('hides the new-block form while engine.isInitialLoading is true', () => {
    renderNewBlockScreen({ isInitialLoading: true });

    expect(screen.queryByRole('form', { name: /new training block/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/block name/i)).not.toBeInTheDocument();
  });

  it('shows an actionable error with Retry when engine.isFatalError is true', () => {
    renderNewBlockScreen({ isFatalError: true });

    expect(screen.getByTestId('stack-screen-error')).toHaveAttribute('role', 'alert');
    expect(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it('calls engine.refetchAll when Retry is pressed on a fatal error', async () => {
    const user = userEvent.setup();
    const refetchAll = vi.fn();
    renderNewBlockScreen({ isFatalError: true, refetchAll });

    await user.click(
      within(screen.getByTestId('stack-screen-error')).getByRole('button', { name: /retry/i }),
    );

    expect(refetchAll).toHaveBeenCalledTimes(1);
  });

  it('does not use viewport-height layout on the screen root', () => {
    renderNewBlockScreen();

    const root = screen.getByRole('form', { name: /new training block/i }).closest('section');
    expect(root).not.toBeNull();
    expect(root).not.toHaveClass('h-screen', 'min-h-screen');
    expect(root?.getAttribute('style') ?? '').not.toMatch(/100vh/i);
  });
});
