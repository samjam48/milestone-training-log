// =============================================================================
// LoadRiskSection — F10.3: Dashboard delayed-tax / load-risk panel
// =============================================================================

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Card } from '../ui/Card';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';

const PROACTIVE_HIT_TYPES = new Set(['elevated_load', 'rest_debt']);
const SYMPTOM_HIT_TYPES = new Set([
  'symptom_marker',
  'acute_attribution',
  'symptom_contributor',
]);

const PROACTIVE_VISIBLE_CAP = 5;

const SAFE_COPY =
  'No elevated load or rest-debt flags in the last 7 days.';

export interface LoadRiskSectionProps {
  delayedTax: DelayedTaxResponse | undefined;
  activityClasses: ActivityClass[];
}

function formatShort(iso: string): string {
  const dt = new Date(iso + 'T00:00:00Z');
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function classLabel(
  activityClassId: string | null | undefined,
  activityClasses: ActivityClass[],
): string {
  if (activityClassId == null) {
    return 'Unknown class';
  }
  return activityClasses.find((c) => c.id === activityClassId)?.name ?? 'Unknown class';
}

function hitDate(hit: DelayedTaxResponse['hits'][number]): string | undefined {
  if (typeof hit.symptomDate === 'string') {
    return hit.symptomDate;
  }
  if (typeof hit.contributingDate === 'string') {
    return hit.contributingDate;
  }
  return undefined;
}

function formatHitLine(
  hit: DelayedTaxResponse['hits'][number],
  activityClasses: ActivityClass[],
): string {
  const message = typeof hit.message === 'string' ? hit.message : '';
  const className = classLabel(
    typeof hit.activityClassId === 'string' ? hit.activityClassId : undefined,
    activityClasses,
  );
  const date = hitDate(hit);
  const dateSuffix = date != null ? ` · ${formatShort(date)}` : '';
  if (message.length > 0) {
    return `${className}${dateSuffix}: ${message}`;
  }
  return `${className}${dateSuffix}`;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-label uppercase font-medium text-ink-muted mb-2">{children}</p>
);

export const LoadRiskSection: React.FC<LoadRiskSectionProps> = ({
  delayedTax,
  activityClasses,
}) => {
  if (delayedTax === undefined) {
    return null;
  }

  const proactiveHits = delayedTax.hits.filter((hit) =>
    PROACTIVE_HIT_TYPES.has(String(hit.hitType)),
  );
  const symptomHits = delayedTax.hits.filter((hit) =>
    SYMPTOM_HIT_TYPES.has(String(hit.hitType)),
  );

  const visibleProactive = proactiveHits.slice(0, PROACTIVE_VISIBLE_CAP);
  const overflowCount = proactiveHits.length - visibleProactive.length;
  const hasAnyHits = proactiveHits.length > 0 || symptomHits.length > 0;
  const cardIntent = proactiveHits.length > 0 ? 'caution' : 'default';

  return (
    <div>
      <SectionLabel>Load risk</SectionLabel>
      <Card intent={cardIntent} pad="sm">
        {visibleProactive.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visibleProactive.map((hit, index) => (
              <li
                key={`proactive-${String(hit.hitType)}-${String(hit.contributingDate)}-${index}`}
                className="text-body text-ink"
              >
                {formatHitLine(hit, activityClasses)}
              </li>
            ))}
          </ul>
        ) : null}

        {overflowCount > 0 ? (
          <p className={cn('text-caption text-ink-muted', visibleProactive.length > 0 && 'mt-2')}>
            and {overflowCount} more
          </p>
        ) : null}

        {symptomHits.length > 0 ? (
          <ul
            className={cn(
              'flex flex-col gap-2',
              (visibleProactive.length > 0 || overflowCount > 0) && 'mt-3 pt-3 border-t border-border-subtle',
            )}
          >
            {symptomHits.map((hit, index) => (
              <li
                key={`symptom-${String(hit.hitType)}-${String(hit.symptomDate ?? hit.contributingDate)}-${index}`}
                className="text-body text-ink"
              >
                {formatHitLine(hit, activityClasses)}
              </li>
            ))}
          </ul>
        ) : null}

        {!hasAnyHits ? (
          <p className="text-caption text-ink-muted py-0.5">{SAFE_COPY}</p>
        ) : null}
      </Card>
    </div>
  );
};
