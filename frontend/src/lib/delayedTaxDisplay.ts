// =============================================================================
// delayedTaxDisplay — user-facing copy for delayed-tax hits (F10.3 / F10.4)
// =============================================================================

import type { DelayedTaxResponse } from '../hooks/useMilestoneEngine';
import type { ActivityClass } from '../types';

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

export function formatDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) {
    return iso;
  }
  const day = Number.parseInt(match[3], 10);
  const month = new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${ordinalDay(day)} ${month}`;
}

function ordinalDay(day: number): string {
  const mod100 = day % 100;
  const mod10 = day % 10;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  if (mod10 === 1) {
    return `${day}st`;
  }
  if (mod10 === 2) {
    return `${day}nd`;
  }
  if (mod10 === 3) {
    return `${day}rd`;
  }
  return `${day}th`;
}

export function classLabel(
  activityClassId: string | null | undefined,
  activityClasses: ActivityClass[],
): string {
  if (activityClassId == null || activityClassId === '') {
    return 'General';
  }
  return activityClasses.find((c) => c.id === activityClassId)?.name ?? 'Unknown class';
}

function primaryDateIso(hit: DelayedTaxResponse['hits'][number]): string | undefined {
  if (typeof hit.symptomDate === 'string') {
    return hit.symptomDate;
  }
  if (typeof hit.contributingDate === 'string') {
    return hit.contributingDate;
  }
  return undefined;
}

function elevatedLoadDetail(message: string): string {
  const loadMatch = /:\s*([\d.]+)\s*\(baseline median\s*([\d.]+)\)/i.exec(message);
  if (loadMatch !== null) {
    return `Load ${loadMatch[1]} vs your usual ${loadMatch[2]}`;
  }
  return 'Load above your recent baseline';
}

function restDebtDetail(message: string): string {
  const gapMatch = /only\s+(\d+)\s+day/i.exec(message);
  const needMatch = /need\s+(\d+)/i.exec(message);
  if (gapMatch !== null && needMatch !== null) {
    return `${gapMatch[1]} day(s) between sessions — rule asks for ${needMatch[1]}`;
  }
  return 'Sessions closer together than your rest rule allows';
}

export interface DelayedTaxHitDisplay {
  key: string;
  className: string;
  dateLabel: string;
  summary: string;
  hitType: string;
}

export function summarizeDelayedTaxHit(
  hit: DelayedTaxResponse['hits'][number],
  index: number,
  activityClasses: ActivityClass[],
): DelayedTaxHitDisplay {
  const hitType = String(hit.hitType);
  const className = classLabel(
    typeof hit.activityClassId === 'string' ? hit.activityClassId : undefined,
    activityClasses,
  );
  const primaryIso = primaryDateIso(hit);
  const dateLabel = primaryIso != null ? formatDisplayDate(primaryIso) : '';

  const message = typeof hit.message === 'string' ? hit.message : '';

  let summary: string;
  switch (hitType) {
    case 'elevated_load':
      summary = elevatedLoadDetail(message);
      break;
    case 'rest_debt':
      summary = restDebtDetail(message);
      break;
    case 'symptom_marker':
      summary = 'Pain or flare recorded';
      break;
    case 'acute_attribution':
      summary =
        message.length > 0 && !ISO_DATE.test(message)
          ? message
          : 'May relate to returning after extended rest';
      break;
    case 'symptom_contributor': {
      const contribIso =
        typeof hit.contributingDate === 'string' ? hit.contributingDate : undefined;
      if (
        contribIso != null &&
        primaryIso != null &&
        contribIso !== primaryIso
      ) {
        summary = `Earlier load on ${formatDisplayDate(contribIso)} may have contributed`;
      } else {
        summary = 'Earlier load this week may have contributed';
      }
      break;
    }
    default:
      summary = message.replace(ISO_DATE, (_, y, m, d) =>
        formatDisplayDate(`${y}-${m}-${d}`),
      );
  }

  const dateKey = primaryIso ?? 'nodate';
  return {
    key: `${hitType}-${dateKey}-${index}`,
    className,
    dateLabel,
    summary,
    hitType,
  };
}

export function summarizeDelayedTaxHits(
  hits: DelayedTaxResponse['hits'],
  activityClasses: ActivityClass[],
): DelayedTaxHitDisplay[] {
  return hits.map((hit, index) => summarizeDelayedTaxHit(hit, index, activityClasses));
}
