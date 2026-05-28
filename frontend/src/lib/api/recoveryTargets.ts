import type { RecoveryTarget } from '../../types';
import { apiFetch } from './client';
import { mapRecoveryTargetCreateBody, mapRecoveryTargetFromApi } from './mappers';

export async function listRecoveryTargetsByBlock(blockId: string): Promise<RecoveryTarget[]> {
  const raw = await apiFetch<Record<string, unknown>[]>(
    `/training-blocks/${blockId}/recovery-targets`,
  );
  return raw.map(mapRecoveryTargetFromApi);
}

export async function createRecoveryTarget(
  blockId: string,
  draft: Record<string, unknown>,
): Promise<RecoveryTarget> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/training-blocks/${blockId}/recovery-targets`,
    {
      method: 'POST',
      body: JSON.stringify(mapRecoveryTargetCreateBody(draft)),
    },
  );
  return mapRecoveryTargetFromApi(raw);
}
