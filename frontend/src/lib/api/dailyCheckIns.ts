import type { ISODate } from '../../types';
import { apiFetch, apiFetchOrNullOn404 } from './client';
import type { DailyCheckInRead } from './mappers';
import {
  buildQuery,
  mapDailyCheckInCreateBody,
  mapDailyCheckInFromApi,
  mapDailyCheckInPatchBody,
} from './mappers';

export type { DailyCheckInRead };

export interface ListDailyCheckInsParams {
  startDate?: ISODate;
  endDate?: ISODate;
}

export async function listDailyCheckIns(
  params: ListDailyCheckInsParams = {},
): Promise<DailyCheckInRead[]> {
  const query = buildQuery({
    from: params.startDate,
    to: params.endDate,
  });
  const raw = await apiFetch<Record<string, unknown>[]>(`/daily-check-ins${query}`);
  return raw.map(mapDailyCheckInFromApi);
}

export async function createDailyCheckIn(
  draft: Record<string, unknown>,
): Promise<DailyCheckInRead> {
  const raw = await apiFetch<Record<string, unknown>>('/daily-check-ins', {
    method: 'POST',
    body: JSON.stringify(mapDailyCheckInCreateBody(draft)),
  });
  return mapDailyCheckInFromApi(raw);
}

export async function getTodayDailyCheckIn(): Promise<DailyCheckInRead | null> {
  const raw = await apiFetchOrNullOn404<Record<string, unknown>>('/daily-check-ins/today');
  return raw == null ? null : mapDailyCheckInFromApi(raw);
}

export async function getDailyCheckInByDate(date: ISODate): Promise<DailyCheckInRead | null> {
  const raw = await apiFetchOrNullOn404<Record<string, unknown>>(`/daily-check-ins/${date}`);
  return raw == null ? null : mapDailyCheckInFromApi(raw);
}

export async function patchDailyCheckIn(
  date: ISODate,
  draft: Record<string, unknown>,
): Promise<DailyCheckInRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/daily-check-ins/${date}`, {
    method: 'PATCH',
    body: JSON.stringify(mapDailyCheckInPatchBody(draft)),
  });
  return mapDailyCheckInFromApi(raw);
}
