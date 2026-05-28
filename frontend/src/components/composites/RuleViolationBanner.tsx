// =============================================================================
// RuleViolationBanner — inline warning shown inside a log form
// -----------------------------------------------------------------------------
// Appears when the user's current draft log would trip one or more rules from
// the active Training Block. Severity follows the worst violation:
//
//   danger  → hard-stop language ("Breaks rest rule") with explicit override CTA
//   caution → soft warning ("Pushing it") with acknowledge CTA
//
// The banner is intentionally NOT a modal. We want the user to see the warning
// while editing the form so they can adjust their entry (lower RPE, swap class)
// in place — modal interruption is over-bearing for a self-tracked log.
//
// We never auto-block submission. The user owns their body; the app surfaces
// risk and records the override (see ActivityLog.ruleViolationsAtLog).
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import type { RuleViolationSnapshot, SafetyState } from '../../types';

export interface RuleViolationBannerProps {
  /** One or more violations the engine produced for the current draft. */
  violations: RuleViolationSnapshot[];
  /**
   * Called when the user explicitly chooses to ignore the warning. The caller
   * should still let them submit — but should also surface a follow-up "are
   * you sure?" if the worst severity is `danger`.
   */
  onOverride?: () => void;
  /** Called when the user dismisses the banner without overriding. */
  onDismiss?: () => void;
  /** Optional CTA text override. */
  overrideLabel?: string;
  className?: string;
}

// -----------------------------------------------------------------------------
// Severity helpers
// -----------------------------------------------------------------------------

const SEVERITY_RANK: Record<SafetyState, number> = {
  safe: 0,
  caution: 1,
  danger: 2,
};

function worstSeverity(vs: RuleViolationSnapshot[]): SafetyState {
  let worst: SafetyState = 'caution';
  for (const v of vs) {
    if (SEVERITY_RANK[v.severity] > SEVERITY_RANK[worst]) worst = v.severity;
  }
  return worst;
}

// -----------------------------------------------------------------------------
// Visual tokens — keyed to the worst severity so the whole banner reads as one
// signal, not a salad of colors per row.
// -----------------------------------------------------------------------------

const tone: Record<SafetyState, {
  intent: 'caution' | 'danger';
  iconRing: string;
  title: string;
  body: string;
  buttonPrimary: string;
  buttonGhost: string;
}> = {
  safe: {
    // unused — banner only renders for caution/danger — but typed for completeness.
    intent: 'caution',
    iconRing: 'ring-safe-border bg-safe/10 text-safe-fg',
    title: 'text-safe-fg',
    body: 'text-ink-muted',
    buttonPrimary: 'bg-safe text-ink-inverse',
    buttonGhost: 'text-safe-fg',
  },
  caution: {
    intent: 'caution',
    iconRing: 'ring-caution-border bg-caution/10 text-caution-fg',
    title: 'text-caution-fg',
    body: 'text-ink-muted',
    buttonPrimary: 'bg-caution text-ink-inverse hover:brightness-110',
    buttonGhost: 'text-caution-fg hover:text-ink',
  },
  danger: {
    intent: 'danger',
    iconRing: 'ring-danger-border bg-danger/10 text-danger-fg',
    title: 'text-danger-fg',
    body: 'text-ink-muted',
    buttonPrimary: 'bg-danger text-ink-inverse hover:brightness-110',
    buttonGhost: 'text-danger-fg hover:text-ink',
  },
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RuleViolationBanner: React.FC<RuleViolationBannerProps> = ({
  violations,
  onOverride,
  onDismiss,
  overrideLabel,
  className,
}) => {
  if (!violations || violations.length === 0) return null;

  const severity = worstSeverity(violations);
  const t = tone[severity];

  const headline =
    severity === 'danger'
      ? violations.length === 1
        ? 'This breaks an active rule'
        : `This breaks ${violations.length} active rules`
      : violations.length === 1
      ? 'You\u2019re pushing your limit'
      : `${violations.length} warnings for this entry`;

  const defaultCta =
    severity === 'danger' ? 'Log anyway' : 'I understand — continue';

  return (
    <Card
      intent={t.intent}
      pad="md"
      role="alert"
      aria-live="polite"
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="flex items-start gap-3">
        {/* Icon disc — drawn inline so we don't pull an icon set for one glyph. */}
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset',
            t.iconRing,
          )}
        >
          <WarningGlyph severity={severity} />
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn('text-body-lg font-semibold', t.title)}>
            {headline}
          </p>

          {/* Per-rule list. We render each message verbatim — the engine owns
              the wording, the banner just frames it. */}
          <ul className="mt-1.5 flex flex-col gap-1">
            {violations.map((v) => (
              <li
                key={v.ruleId}
                className={cn('text-body flex gap-2', t.body)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-2 h-1 w-1 shrink-0 rounded-full',
                    v.severity === 'danger' ? 'bg-danger' : 'bg-caution',
                  )}
                />
                <span className="text-ink">{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions — only render the row if a handler is wired. Keeps the banner
          usable as a pure display (e.g. on the log-history row's expanded view). */}
      {(onOverride || onDismiss) && (
        <div className="flex items-center justify-end gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                'h-9 px-3 rounded-md text-body font-medium transition-colors duration-snap ease-out-quint',
                t.buttonGhost,
              )}
            >
              Edit entry
            </button>
          )}
          {onOverride && (
            <button
              type="button"
              onClick={onOverride}
              className={cn(
                'h-9 px-3 rounded-md text-body font-semibold transition-colors duration-snap ease-out-quint',
                t.buttonPrimary,
              )}
            >
              {overrideLabel ?? defaultCta}
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

// -----------------------------------------------------------------------------
// Inline glyph — caution triangle for caution, no-entry for danger. Drawn as
// simple paths so we stay icon-set agnostic.
// -----------------------------------------------------------------------------

const WarningGlyph: React.FC<{ severity: SafetyState }> = ({ severity }) => {
  if (severity === 'danger') {
    // No-entry circle
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  // Caution triangle with exclamation
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none">
      <path
        d="M8 2.5 L14 13 H2 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="0.85" fill="currentColor" />
    </svg>
  );
};
