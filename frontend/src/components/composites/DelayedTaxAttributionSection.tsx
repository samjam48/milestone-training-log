// =============================================================================
// DelayedTaxAttributionSection — F10.4: symptom-linked load attribution
// =============================================================================

import * as React from 'react';
import { Card } from '../ui/Card';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';

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
}

function filterHits(
  hits: DelayedTaxResponse['hits'],
  types: Set<string>,
): DelayedTaxResponse['hits'] {
  return hits.filter((hit) => types.has(String(hit.hitType)));
}

function hitKey(hit: DelayedTaxResponse['hits'][number], index: number): string {
  return `${String(hit.hitType)}-${String(hit.symptomDate ?? hit.contributingDate)}-${index}`;
}

export const DelayedTaxAttributionSection: React.FC<DelayedTaxAttributionSectionProps> = ({
  delayedTax,
  delayedTaxError = false,
}) => {
  const symptomHits =
    delayedTax === undefined ? [] : filterHits(delayedTax.hits, SYMPTOM_HIT_TYPES);
  const proactiveHits =
    delayedTax === undefined ? [] : filterHits(delayedTax.hits, PROACTIVE_HIT_TYPES);
  const visibleHits = symptomHits.length > 0 ? symptomHits : proactiveHits;

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
        ) : visibleHits.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visibleHits.map((hit, index) => (
              <li key={hitKey(hit, index)} className="text-body text-ink">
                {typeof hit.message === 'string' ? hit.message : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ink-muted py-0.5">{EMPTY_COPY}</p>
        )}
      </Card>
    </div>
  );
};
