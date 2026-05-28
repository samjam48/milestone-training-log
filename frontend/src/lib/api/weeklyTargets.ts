import type { WeeklyTarget } from '../../types';
import { apiFetch } from './client';
import {
  mapWeeklyTargetCreateBody,
  mapWeeklyTargetFromApi,
  mapWeeklyTargetPatchBody,
} from './mappers';

export async function listWeeklyTargetsByBlock(blockId: string): Promise<WeeklyTarget[]> {
  const raw = await apiFetch<Record<string, unknown>[]>(
    `/training-blocks/${blockId}/weekly-targets`,
  );
  return raw.map(mapWeeklyTargetFromApi);
}

export async function createWeeklyTarget(
  blockId: string,
  draft: Record<string, unknown>,
): Promise<WeeklyTarget> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/training-blocks/${blockId}/weekly-targets`,
    {
      method: 'POST',
      body: JSON.stringify(mapWeeklyTargetCreateBody(draft)),
    },
  );
  return mapWeeklyTargetFromApi(raw);
}

export async function patchWeeklyTarget(
  targetId: string,
  draft: Record<string, unknown>,
): Promise<WeeklyTarget> {
  const raw = await apiFetch<Record<string, unknown>>(`/weekly-targets/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapWeeklyTargetPatchBody(draft)),
  });
  return mapWeeklyTargetFromApi(raw);
}
