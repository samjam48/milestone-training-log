import type { Goal, GoalStatus } from '../../types';
import { apiFetch } from './client';
import { buildQuery, mapGoalCreateBody, mapGoalFromApi, mapGoalPatchBody } from './mappers';

type GoalRead = Omit<Goal, 'userId'>;

export interface ListGoalsParams {
  status?: GoalStatus;
  timeframe?: Goal['timeframe'];
}

export async function listGoals(params: ListGoalsParams = {}): Promise<GoalRead[]> {
  const query = buildQuery({
    status: params.status,
    timeframe: params.timeframe,
  });
  const raw = await apiFetch<Record<string, unknown>[]>(`/goals${query}`);
  return raw.map(mapGoalFromApi);
}

export async function createGoal(draft: Record<string, unknown>): Promise<GoalRead> {
  const raw = await apiFetch<Record<string, unknown>>('/goals', {
    method: 'POST',
    body: JSON.stringify(mapGoalCreateBody(draft)),
  });
  return mapGoalFromApi(raw);
}

export async function patchGoal(goalId: string, draft: Record<string, unknown>): Promise<GoalRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapGoalPatchBody(draft)),
  });
  return mapGoalFromApi(raw);
}
