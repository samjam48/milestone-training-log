// =============================================================================
// CenteredModal — fixed center-aligned dialog with scrim and internal scroll
// =============================================================================

import * as React from 'react';

export interface CenteredModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

export function CenteredModal({
  open,
  onClose,
  ariaLabel,
  children,
}: CenteredModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <>
      <div
        data-testid="centered-modal-scrim"
        className="fixed inset-0 z-50 bg-black/60"
        style={{ backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-safe-top pb-safe-bottom pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          data-testid="centered-modal-panel"
          className="pointer-events-auto w-full max-w-sm rounded-2xl bg-bg-raised border border-border shadow-lg flex flex-col"
        >
          <div
            data-testid="centered-modal-scroll"
            className="overflow-y-auto max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] px-4 py-4"
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
