import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

const HISTORY_STATE = { milestone: true } as const;

export function useMilestoneNavigationHistory(options: {
  enabled: boolean;
  overlayOpen: boolean;
  stackDepth: number;
  onCloseOverlay: () => void;
  onPopScreen: () => void;
}): { navigateBack: () => void } {
  const { enabled, overlayOpen, stackDepth, onCloseOverlay, onPopScreen } = options;

  const onCloseOverlayRef = useRef(onCloseOverlay);
  const onPopScreenRef = useRef(onPopScreen);
  onCloseOverlayRef.current = onCloseOverlay;
  onPopScreenRef.current = onPopScreen;

  const navRef = useRef({ overlayOpen, stackDepth });
  navRef.current = { overlayOpen, stackDepth };

  const prevOverlayRef = useRef(overlayOpen);
  const prevStackDepthRef = useRef(stackDepth);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      prevOverlayRef.current = false;
      prevStackDepthRef.current = 0;
      return;
    }
    if (!seededRef.current) {
      window.history.replaceState(HISTORY_STATE, '');
      seededRef.current = true;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      prevOverlayRef.current = overlayOpen;
      prevStackDepthRef.current = stackDepth;
      return;
    }

    if (overlayOpen && !prevOverlayRef.current) {
      window.history.pushState(HISTORY_STATE, '');
    }

    if (stackDepth > prevStackDepthRef.current) {
      for (let i = prevStackDepthRef.current; i < stackDepth; i += 1) {
        window.history.pushState(HISTORY_STATE, '');
      }
    }

    prevOverlayRef.current = overlayOpen;
    prevStackDepthRef.current = stackDepth;
  }, [enabled, overlayOpen, stackDepth]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handlePopState = (): void => {
      const { overlayOpen: hasOverlay, stackDepth: depth } = navRef.current;
      flushSync(() => {
        if (hasOverlay) {
          onCloseOverlayRef.current();
        } else if (depth > 0) {
          onPopScreenRef.current();
        }
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled]);

  const navigateBack = useCallback((): void => {
    window.history.back();
  }, []);

  return { navigateBack };
}
