import type { Activity } from '../../types';
import { apiFetch } from './client';
import { buildQuery, mapActivityCreateBody, mapActivityFromApi, mapActivityPatchBody } from './mappers';

type ActivityRead = Omit<Activity, 'userId'>;

export interface ListActivitiesParams {
  classId?: string;
  isActive?: boolean;
}

export async function listActivities(params: ListActivitiesParams = {}): Promise<ActivityRead[]> {
  const query = buildQuery({
    class_id: params.classId,
    is_active: params.isActive,
  });
  const raw = await apiFetch<Record<string, unknown>[]>(`/activities${query}`);
  return raw.map(mapActivityFromApi);
}

export async function createActivity(draft: Record<string, unknown>): Promise<ActivityRead> {
  const raw = await apiFetch<Record<string, unknown>>('/activities', {
    method: 'POST',
    body: JSON.stringify(mapActivityCreateBody(draft)),
  });
  return mapActivityFromApi(raw);
}

export async function patchActivity(
  activityId: string,
  draft: Record<string, unknown>,
): Promise<ActivityRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/activities/${activityId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapActivityPatchBody(draft)),
  });
  return mapActivityFromApi(raw);
}
