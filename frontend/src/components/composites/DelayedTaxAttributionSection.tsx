// =============================================================================
// DelayedTaxAttributionSection — F10.4: symptom-linked load attribution
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import {
  summarizeDelayedTaxHits,
  type DelayedTaxHitDisplay,
} from '../../lib/delayedTaxDisplay';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';

const PROACTIVE_HIT_TYPES = new Set(['elevated_load', 'rest_debt']);
const SYMPTOM_HIT_TYPES = new Set([
  'symptom_marker',
  'acute_attribution',
  'symptom_contributor',
]);

const EMPTY_COPY = 'No stacked load patterns detected this week.';
const LOADING_COPY = 'Loading attribution…';
const ERROR_COPY = 'Could not load attribution';

export interface DelayedTaxAttributionSectionProps {
  delayedTax: DelayedTaxResponse | undefined;
  delayedTaxError?: boolean;
  activityClasses?: ActivityClass[];
}

function filterHits(
  hits: DelayedTaxResponse['hits'],
  types: Set<string>,
): DelayedTaxResponse['hits'] {
  return hits.filter((hit) => types.has(String(hit.hitType)));
}

function HitRow({ row }: { row: DelayedTaxHitDisplay }) {
  const isCaution =
    row.hitType === 'elevated_load' ||
    row.hitType === 'rest_debt' ||
    row.hitType === 'symptom_contributor';

  return (
    <li
      className="flex gap-3 py-2 first:pt-0 last:pb-0"
      data-testid="delayed-tax-hit-row"
    >
      <span
        className={cn(
          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
          isCaution ? 'bg-caution' : 'bg-danger',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-body font-medium text-ink truncate">{row.className}</span>
          {row.dateLabel.length > 0 ? (
            <span className="text-caption text-ink-muted shrink-0">{row.dateLabel}</span>
          ) : null}
        </div>
        <p className="text-caption text-ink-muted mt-0.5">{row.summary}</p>
      </div>
    </li>
  );
}

export const DelayedTaxAttributionSection: React.FC<DelayedTaxAttributionSectionProps> = ({
  delayedTax,
  delayedTaxError = false,
  activityClasses = [],
}) => {
  const symptomHits =
    delayedTax === undefined ? [] : filterHits(delayedTax.hits, SYMPTOM_HIT_TYPES);
  const proactiveHits =
    delayedTax === undefined ? [] : filterHits(delayedTax.hits, PROACTIVE_HIT_TYPES);
  const sourceHits = symptomHits.length > 0 ? symptomHits : proactiveHits;
  const rows = summarizeDelayedTaxHits(sourceHits, activityClasses);

  return (
    <div className="w-full max-w-md text-left">
      <p className="text-label uppercase font-medium text-ink-muted mb-2">
        What may have contributed
      </p>
      <Card pad="sm">
        {delayedTaxError ? (
          <p className="text-caption text-ink-muted py-0.5">{ERROR_COPY}</p>
        ) : delayedTax === undefined ? (
          <p className="text-caption text-ink-muted py-0.5">{LOADING_COPY}</p>
        ) : rows.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {rows.map((row) => (
              <HitRow key={row.key} row={row} />
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ink-muted py-0.5">{EMPTY_COPY}</p>
        )}
      </Card>
    </div>
  );
};
