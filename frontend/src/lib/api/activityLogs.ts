import type { ISODate } from '../../types';
import { apiFetch } from './client';
import type { ActivityLogRead } from './mappers';
import {
  buildQuery,
  mapActivityLogCreateBody,
  mapActivityLogFromApi,
  mapActivityLogPatchBody,
} from './mappers';

export type { ActivityLogRead };

export interface ListActivityLogsParams {
  startDate?: ISODate;
  endDate?: ISODate;
  activityId?: string;
  classId?: string;
}

export async function listActivityLogs(
  params: ListActivityLogsParams = {},
): Promise<ActivityLogRead[]> {
  const query = buildQuery({
    from: params.startDate,
    to: params.endDate,
    activity_id: params.activityId,
    class_id: params.classId,
  });
  const raw = await apiFetch<Record<string, unknown>[]>(`/activity-logs${query}`);
  return raw.map(mapActivityLogFromApi);
}

export async function createActivityLog(
  draft: Record<string, unknown>,
): Promise<ActivityLogRead> {
  const raw = await apiFetch<Record<string, unknown>>('/activity-logs', {
    method: 'POST',
    body: JSON.stringify(mapActivityLogCreateBody(draft)),
  });
  return mapActivityLogFromApi(raw);
}

export async function patchActivityLog(
  logId: string,
  draft: Record<string, unknown>,
): Promise<ActivityLogRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/activity-logs/${logId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapActivityLogPatchBody(draft)),
  });
  return mapActivityLogFromApi(raw);
}

export async function deleteActivityLog(logId: string): Promise<void> {
  await apiFetch<void>(`/activity-logs/${logId}`, { method: 'DELETE' });
}
