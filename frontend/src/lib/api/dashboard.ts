import { apiFetch } from './client';
import { buildQuery, mapDashboardFromApi, type DashboardPayload } from './mappers';
import type { ISODate } from '../../types';

export async function getDashboard(asOf?: ISODate): Promise<DashboardPayload> {
  const query = buildQuery(asOf !== undefined ? { as_of: asOf } : {});
  const raw = await apiFetch<Record<string, unknown>>(`/dashboard${query}`);
  return mapDashboardFromApi(raw);
}
