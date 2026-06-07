import type { DailyCheckIn, FlareUpIncident } from '../types';

type BodyPartCheckIn = Pick<
  DailyCheckIn,
  'checkInDate' | 'createdAt' | 'hasFlareUp' | 'flareUp'
>;

interface BodyPartSource {
  label: string;
  sortDate: string;
  sortCreatedAt: string;
}

function collectSources(
  incidents: FlareUpIncident[],
  checkIns: BodyPartCheckIn[],
): BodyPartSource[] {
  const sources: BodyPartSource[] = [];

  for (const incident of incidents) {
    const label = incident.bodyPart.trim();
    if (!label) continue;
    sources.push({
      label,
      sortDate: incident.incidentDate,
      sortCreatedAt: incident.createdAt,
    });
  }

  for (const checkIn of checkIns) {
    if (!checkIn.hasFlareUp || checkIn.flareUp == null) continue;
    const label = checkIn.flareUp.bodyPart.trim();
    if (!label) continue;
    sources.push({
      label,
      sortDate: checkIn.checkInDate,
      sortCreatedAt: checkIn.createdAt,
    });
  }

  return sources.sort((a, b) => {
    const byDate = b.sortDate.localeCompare(a.sortDate);
    if (byDate !== 0) return byDate;
    return b.sortCreatedAt.localeCompare(a.sortCreatedAt);
  });
}

/** Distinct trimmed body parts from incidents and check-in flares, recent-first. */
export function buildBodyPartSuggestions(
  incidents: FlareUpIncident[],
  checkIns: BodyPartCheckIn[],
): string[] {
  const byKey = new Map<string, string>();
  for (const { label } of collectSources(incidents, checkIns)) {
    const key = label.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, label);
  }
  return [...byKey.values()];
}
