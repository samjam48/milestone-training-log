import type { ActivityClass } from '../../types';
import { apiFetch } from './client';
import {
  mapActivityClassCreateBody,
  mapActivityClassFromApi,
  mapActivityClassPatchBody,
} from './mappers';

type ActivityClassRead = Omit<ActivityClass, 'userId'>;

export async function listActivityClasses(): Promise<ActivityClassRead[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/activity-classes');
  return raw.map(mapActivityClassFromApi);
}

export async function createActivityClass(
  draft: Record<string, unknown>,
): Promise<ActivityClassRead> {
  const raw = await apiFetch<Record<string, unknown>>('/activity-classes', {
    method: 'POST',
    body: JSON.stringify(mapActivityClassCreateBody(draft)),
  });
  return mapActivityClassFromApi(raw);
}

export async function patchActivityClass(
  classId: string,
  draft: Record<string, unknown>,
): Promise<ActivityClassRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/activity-classes/${classId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapActivityClassPatchBody(draft)),
  });
  return mapActivityClassFromApi(raw);
}
