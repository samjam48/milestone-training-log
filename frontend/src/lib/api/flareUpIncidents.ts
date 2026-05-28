import type { FlareUpIncident } from '../../types';
import { apiFetch } from './client';
import {
  mapFlareUpIncidentCreateBody,
  mapFlareUpIncidentFromApi,
  mapFlareUpIncidentPatchBody,
} from './mappers';

type FlareUpIncidentRead = Omit<FlareUpIncident, 'userId'>;

export async function listFlareUpIncidents(): Promise<FlareUpIncidentRead[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/flare-up-incidents');
  return raw.map(mapFlareUpIncidentFromApi);
}

export async function createFlareUpIncident(
  draft: Record<string, unknown>,
): Promise<FlareUpIncidentRead> {
  const raw = await apiFetch<Record<string, unknown>>('/flare-up-incidents', {
    method: 'POST',
    body: JSON.stringify(mapFlareUpIncidentCreateBody(draft)),
  });
  return mapFlareUpIncidentFromApi(raw);
}

export async function patchFlareUpIncident(
  incidentId: string,
  draft: Record<string, unknown>,
): Promise<FlareUpIncidentRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/flare-up-incidents/${incidentId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapFlareUpIncidentPatchBody(draft)),
  });
  return mapFlareUpIncidentFromApi(raw);
}
