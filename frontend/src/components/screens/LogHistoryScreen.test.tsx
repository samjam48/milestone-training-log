/**
 * C6.2 — Log History sticky CTA acceptance tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createLogHistoryEngine } from '../../test/fixtures/c62Fixtures';
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
});
