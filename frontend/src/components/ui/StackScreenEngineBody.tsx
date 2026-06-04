import * as React from 'react';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';

export interface StackScreenEngineBodyProps {
  engine: MilestoneEngineResult;
  /** When true, skip the loading skeleton (e.g. GoalEditor edit mode with goal param). */
  skipLoading?: boolean;
  children: React.ReactNode;
}

export function stackScreenEngineBlocked(
  engine: MilestoneEngineResult,
  options?: { skipLoading?: boolean },
): boolean {
  if (engine.isFatalError) return true;
  if (engine.isInitialLoading && !options?.skipLoading) return true;
  return false;
}

export function StackScreenEngineBody({
  engine,
  skipLoading = false,
  children,
}: StackScreenEngineBodyProps): React.ReactElement {
  if (engine.isFatalError) {
    return (
      <div
        data-testid="stack-screen-error"
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12"
      >
        <p className="text-body-lg text-center text-ink-muted">Could not reach server</p>
        <button
          type="button"
          onClick={() => engine.refetchAll()}
          className="rounded-md bg-bg-sunken px-4 py-2 text-body font-medium text-ink"
        >
          Retry
        </button>
      </div>
    );
  }

  if (engine.isInitialLoading && !skipLoading) {
    return (
      <div
        data-testid="stack-screen-loading"
        aria-busy="true"
        className="flex flex-1 flex-col gap-4 px-4 py-5"
      >
        <div className="skeleton h-10 w-full rounded-md bg-bg-sunken animate-pulse" />
        <div className="skeleton h-24 w-full rounded-lg bg-bg-sunken animate-pulse" />
        <div className="skeleton h-32 w-full rounded-lg bg-bg-sunken animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
