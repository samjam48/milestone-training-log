import type { ISODate, RuleViolationSnapshot } from '../../types';
import { apiFetch } from './client';
import {
  buildQuery,
  mapCheckViolationsRequestBody,
  mapCheckViolationsResponseFromApi,
  mapDelayedTaxResponseFromApi,
  mapLoadSummaryFromApi,
} from './mappers';

export interface LoadSummaryParams {
  asOf?: ISODate;
}

export async function getLoadSummary(params: LoadSummaryParams = {}) {
  const query = buildQuery(params.asOf !== undefined ? { as_of: params.asOf } : {});
  const raw = await apiFetch<Record<string, unknown>>(`/load/summary${query}`);
  return mapLoadSummaryFromApi(raw);
}

export interface CheckViolationsInput {
  activityId: string;
  volumeValue: number;
  rpe: number;
  asOf?: ISODate;
  durationMinutes?: number;
  volumeUnit?: string;
}

export async function checkViolations(
  input: CheckViolationsInput,
): Promise<{ violations: RuleViolationSnapshot[] }> {
  const raw = await apiFetch<Record<string, unknown>>('/load/check-violations', {
    method: 'POST',
    body: JSON.stringify(mapCheckViolationsRequestBody(input)),
  });
  return mapCheckViolationsResponseFromApi(raw);
}

export interface DelayedTaxParams {
  asOf?: ISODate;
  riskWindowDays?: number;
  baselineDays?: number;
  painThreshold?: number;
}

export async function getDelayedTax(params: DelayedTaxParams = {}) {
  const query = buildQuery({
    as_of: params.asOf,
    risk_window_days: params.riskWindowDays,
    baseline_days: params.baselineDays,
    pain_threshold: params.painThreshold,
  });
  const raw = await apiFetch<Record<string, unknown>>(`/load/delayed-tax${query}`);
  return mapDelayedTaxResponseFromApi(raw);
}
