import { vi } from 'vitest';

/** Spy pushState / replaceState / back for navigation-history assertions. */
export function spyOnBrowserHistory(): {
  pushState: ReturnType<typeof vi.spyOn>;
  replaceState: ReturnType<typeof vi.spyOn>;
  back: ReturnType<typeof vi.spyOn>;
} {
  return {
    pushState: vi.spyOn(window.history, 'pushState'),
    replaceState: vi.spyOn(window.history, 'replaceState'),
    back: vi.spyOn(window.history, 'back'),
  };
}

/** Simulate Android system Back / browser popstate. */
export function dispatchPopState(state: unknown = null): void {
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

type HistoryBackSpy = {
  mockImplementation: (fn: () => void) => void;
  mockRestore: () => void;
};

/**
 * When in-app Back calls history.back(), jsdom does not fire popstate.
 * Bridge back() → popstate so RTL tests mirror browser behavior.
 * Reuses an existing back spy when provided (e.g. from spyOnBrowserHistory).
 */
export function bridgeHistoryBackToPopstate(
  existingBackSpy?: HistoryBackSpy,
): () => void {
  const backSpy = existingBackSpy ?? vi.spyOn(window.history, 'back');
  backSpy.mockImplementation(() => {
    dispatchPopState(window.history.state);
  });
  return () => {
    backSpy.mockRestore();
  };
}
