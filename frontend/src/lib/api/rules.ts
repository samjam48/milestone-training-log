import type { Rule } from '../../types';
import { apiFetch } from './client';
import { mapRuleCreateBody, mapRuleFromApi, mapRulePatchBody } from './mappers';

export async function listRulesByBlock(blockId: string): Promise<Rule[]> {
  const raw = await apiFetch<Record<string, unknown>[]>(`/training-blocks/${blockId}/rules`);
  return raw.map(mapRuleFromApi);
}

export async function createRule(
  blockId: string,
  draft: Record<string, unknown>,
): Promise<Rule> {
  const raw = await apiFetch<Record<string, unknown>>(`/training-blocks/${blockId}/rules`, {
    method: 'POST',
    body: JSON.stringify(mapRuleCreateBody(draft)),
  });
  return mapRuleFromApi(raw);
}

export async function patchRule(ruleId: string, draft: Record<string, unknown>): Promise<Rule> {
  const raw = await apiFetch<Record<string, unknown>>(`/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapRulePatchBody(draft)),
  });
  return mapRuleFromApi(raw);
}

export async function deleteRule(ruleId: string): Promise<void> {
  await apiFetch<void>(`/rules/${ruleId}`, { method: 'DELETE' });
}
