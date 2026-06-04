/**
 * C6.2 — Log History sticky CTA acceptance tests.
 * F10.8 — Illustrated empty state (plans/tickets-phase-10-polish-2026-06-04.md).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createLogHistoryEngine, logActivityWalk } from '../../test/fixtures/c62Fixtures';
import { LogHistoryScreen } from './LogHistoryScreen';

const VIEWPORT_HEIGHT = 520;

function getActionBar(): HTMLElement {
  const logActivityButton = screen.getByRole('button', { name: '+ Log Activity' });
  const actionBar = logActivityButton.closest('.border-t.border-border');
  expect(actionBar).not.toBeNull();
  return actionBar as HTMLElement;
}

function getScrollRegion(): HTMLElement {
  const scrollRegion = document.querySelector('.overflow-y-auto');
  expect(scrollRegion).not.toBeNull();
  return scrollRegion as HTMLElement;
}

describe('LogHistoryScreen sticky CTAs (C6.2)', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps + Log Activity and + Log Incident pinned outside the scrolling history list', () => {
    const engine = createLogHistoryEngine(40);

    renderWithProviders(
      <div
        style={{
          height: `${VIEWPORT_HEIGHT}px`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <LogHistoryScreen
          engine={engine}
          onOpenLogActivity={vi.fn()}
          onOpenLogIncident={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByText(`${engine.logs.length} sessions logged`)).toBeInTheDocument();

    const scrollRegion = getScrollRegion();
    const actionBar = getActionBar();

    expect(scrollRegion.contains(actionBar)).toBe(false);
    expect(actionBar.contains(scrollRegion)).toBe(false);
    expect(actionBar.className).toMatch(/shrink-0/);
    expect(scrollRegion.className).toMatch(/min-h-0/);

    expect(screen.getByRole('button', { name: '+ Log Activity' })).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Log Incident' })).toBeVisible();
  });

  it('uses an independently scrollable history region so CTAs stay reachable with long history', () => {
    const engine = createLogHistoryEngine(40);

    renderWithProviders(
      <div
        style={{
          height: `${VIEWPORT_HEIGHT}px`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <LogHistoryScreen
          engine={engine}
          onOpenLogActivity={vi.fn()}
          onOpenLogIncident={vi.fn()}
        />
      </div>,
    );

    const scrollRegion = getScrollRegion();
    const actionBar = getActionBar();
    const screenRoot = scrollRegion.parentElement;

    expect(screenRoot?.className).toMatch(/min-h-0/);
    expect(scrollRegion.className).toMatch(/flex-1/);
    expect(scrollRegion.className).toMatch(/overflow-y-auto/);
    expect(actionBar.className).toMatch(/shrink-0/);
  });

  it('still resolves activity labels for logs tied to inactive activities', () => {
    const engine = createLogHistoryEngine(1, {
      activities: [{ ...logActivityWalk, isActive: false }],
    });

    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );

    expect(screen.getByText(logActivityWalk.name)).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });
});

describe('LogHistoryScreen — F10.8 illustrated empty state', () => {
  afterEach(() => {
    cleanup();
  });

  function renderLogHistory(logCount: number): void {
    const engine = createLogHistoryEngine(logCount);
    renderWithProviders(
      <LogHistoryScreen
        engine={engine}
        onOpenLogActivity={vi.fn()}
        onOpenLogIncident={vi.fn()}
      />,
    );
  }

  it('renders log-history-empty-state when there are no sessions', () => {
    renderLogHistory(0);

    expect(screen.getByTestId('log-history-empty-state')).toBeInTheDocument();
  });

  it('shows an illustration inside the empty state region', () => {
    renderLogHistory(0);

    const emptyState = screen.getByTestId('log-history-empty-state');
    expect(within(emptyState).getByTestId('log-history-empty-illustration')).toBeInTheDocument();
  });

  it('keeps existing "No sessions logged yet" copy inside the empty state', () => {
    renderLogHistory(0);

    const emptyState = screen.getByTestId('log-history-empty-state');
    expect(within(emptyState).getByText(/no sessions logged yet/i)).toBeInTheDocument();
  });

  it('keeps + Log Activity and + Log Incident CTAs visible when history is empty', () => {
    renderLogHistory(0);

    expect(screen.getByRole('button', { name: '+ Log Activity' })).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Log Incident' })).toBeVisible();
  });

  it('does not render log-history-empty-state when sessions exist', () => {
    renderLogHistory(1);

    expect(screen.queryByTestId('log-history-empty-state')).not.toBeInTheDocument();
    expect(screen.getByText(/1 sessions logged/i)).toBeInTheDocument();
  });
});
