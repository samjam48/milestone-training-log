// =============================================================================
// ActivityLogRow — Tier 1 primitive / domain-aware row
// -----------------------------------------------------------------------------
// The canonical row for any list of ActivityLogs. Composes entirely from
// design tokens — no engine calls, no side-effects. Pure display.
//
// Used by: LogHistoryScreen, any future "recent sessions" widget.
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import type { ActivityLog, PostActivityFeel, SafetyState } from '../../types';

export interface ActivityLogRowProps {
  log: ActivityLog;
  /** Pre-resolved name (avoid re-doing the activityId → name lookup on every render). */
  activityName: string;
  /** Optional press handler — adds tap feedback and cursor-pointer. */
  onPress?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Feel → visual mapping
// ---------------------------------------------------------------------------

interface FeelStyle { label: string; pill: string }

function feelStyle(feel?: PostActivityFeel): FeelStyle {
  if (feel === 'mild_discomfort') return { label: 'Discomfort', pill: 'bg-caution/15 text-caution-fg' };
  if (feel === 'bad')             return { label: 'Bad',        pill: 'bg-danger/15  text-danger-fg'  };
  return                                 { label: 'Fine',       pill: 'bg-safe/15    text-safe-fg'    };
}

// ---------------------------------------------------------------------------
// Inline pieces
// ---------------------------------------------------------------------------

const Pill: React.FC<{ children: React.ReactNode; className: string }> = ({ children, className }) => (
  <span className={cn('inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium shrink-0', className)}>
    {children}
  </span>
);

/** Small triangle icon — only rendered when at least one violation was recorded. */
const ViolationIcon: React.FC<{ severity: SafetyState }> = ({ severity }) => (
  <span
    aria-label="Rule violation recorded"
    className={cn(
      'inline-flex items-center justify-center h-4 w-4 shrink-0',
      severity === 'danger' ? 'text-danger-fg' : 'text-caution-fg',
    )}
  >
    <svg viewBox="0 0 12 12" width={12} height={12} fill="none" aria-hidden="true">
      <path d="M6 1.5L11 10H1L6 1.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <line x1="6" y1="4.5" x2="6" y2="7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="6" cy="8.5" r="0.65" fill="currentColor" />
    </svg>
  </span>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ActivityLogRow: React.FC<ActivityLogRowProps> = ({
  log,
  activityName,
  onPress,
  className,
}) => {
  const feel = feelStyle(log.postActivityFeel);
  const violations = log.ruleViolationsAtLog ?? [];
  const hasViolation = violations.length > 0;
  const worstViolation = violations.find(v => v.severity === 'danger') ?? violations[0];

  return (
    <div
      role={onPress ? 'button' : undefined}
      tabIndex={onPress ? 0 : undefined}
      onClick={onPress}
      onKeyDown={onPress ? (e) => e.key === 'Enter' && onPress() : undefined}
      className={cn(
        'flex flex-col gap-1.5 py-3 px-4',
        onPress && 'cursor-pointer active:bg-bg-overlay transition-colors duration-snap',
        className,
      )}
    >
      {/* Row 1 — name + feel badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {hasViolation && <ViolationIcon severity={worstViolation.severity} />}
          <span className="text-body font-semibold text-ink truncate">{activityName}</span>
        </div>
        <Pill className={feel.pill}>{feel.label}</Pill>
      </div>

      {/* Row 2 — metrics */}
      <div className="flex items-center gap-3 text-caption text-ink-muted">
        <span>{log.durationMinutes} min</span>
        {log.volumeValue > 0 && log.volumeUnit && (
          <><span aria-hidden="true">·</span><span>{log.volumeValue} {log.volumeUnit}</span></>
        )}
        {log.rpe && (
          <><span aria-hidden="true">·</span><span className="font-metric tabular-nums">RPE {log.rpe}</span></>
        )}
      </div>

      {/* Row 3 — violation message (inline, not a full banner) */}
      {hasViolation && worstViolation && (
        <p className={cn(
          'text-caption',
          worstViolation.severity === 'danger' ? 'text-danger-fg' : 'text-caution-fg',
        )}>
          {worstViolation.message}
        </p>
      )}
    </div>
  );
};
