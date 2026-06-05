/**
 * S2.1 — AppShell viewport height and bottom inset (tab bar vs overlay).
 * plans/tickets-stage-2-polish-2026-06-05.md
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  APPSHELL_VIEWPORT_HEIGHT_CLASS,
  SAFE_BOTTOM_ONLY_INSET,
  TAB_BAR_SAFE_BOTTOM_INSET,
} from '../../test/bottomInsetLayout';
import { AppShell } from './AppShell';

function getShellRoot(): HTMLElement {
  return screen.getByTestId('app-shell-root');
}

describe('AppShell — S2.1 bottom inset and viewport', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses 100svh for shell height so the layout viewport matches the visible area', () => {
    render(
      <AppShell data-testid="app-shell-root">
        <p>content</p>
      </AppShell>,
    );

    const shell = getShellRoot();
    expect(shell.className).toContain(APPSHELL_VIEWPORT_HEIGHT_CLASS);
    expect(shell.className).not.toMatch(/\bh-dvh\b/);
  });

  it('keeps desktop phone-width preview (max-w-[440px])', () => {
    render(
      <AppShell data-testid="app-shell-root">
        <p>content</p>
      </AppShell>,
    );

    expect(getShellRoot().className).toContain('max-w-[440px]');
  });

  it('applies tabbar + safe-bottom padding when withTabBar is true', () => {
    render(
      <AppShell withTabBar data-testid="app-shell-root">
        <p>content</p>
      </AppShell>,
    );

    expect(getShellRoot().className).toContain(TAB_BAR_SAFE_BOTTOM_INSET);
  });

  it('applies safe-bottom only (no tabbar calc) when withTabBar is false', () => {
    render(
      <AppShell withTabBar={false} data-testid="app-shell-root">
        <p>content</p>
      </AppShell>,
    );

    const shell = getShellRoot();
    expect(shell.className).toContain(SAFE_BOTTOM_ONLY_INSET);
    expect(shell.className).not.toContain('spacing.tabbar');
  });
});
