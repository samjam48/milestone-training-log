import type { DailySafetyScore, TrainingBlock } from '../../types';
import { apiFetch, apiFetchOrNullOn404 } from './client';
import {
  mapTrainingBlockCreateBody,
  mapTrainingBlockFromApi,
  mapTrainingBlockPatchBody,
  mapDailySafetyScoreFromApi,
} from './mappers';

type TrainingBlockRead = Omit<TrainingBlock, 'userId'>;

export async function listTrainingBlocks(): Promise<TrainingBlockRead[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/training-blocks');
  return raw.map(mapTrainingBlockFromApi);
}

export async function getActiveTrainingBlock(): Promise<TrainingBlockRead | null> {
  const raw = await apiFetchOrNullOn404<Record<string, unknown>>('/training-blocks/active');
  return raw == null ? null : mapTrainingBlockFromApi(raw);
}

export async function createTrainingBlock(
  draft: Record<string, unknown>,
): Promise<TrainingBlockRead> {
  const raw = await apiFetch<Record<string, unknown>>('/training-blocks', {
    method: 'POST',
    body: JSON.stringify(mapTrainingBlockCreateBody(draft)),
  });
  return mapTrainingBlockFromApi(raw);
}

export async function patchTrainingBlock(
  blockId: string,
  draft: Record<string, unknown>,
): Promise<TrainingBlockRead> {
  const raw = await apiFetch<Record<string, unknown>>(`/training-blocks/${blockId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapTrainingBlockPatchBody(draft)),
  });
  return mapTrainingBlockFromApi(raw);
}

interface TrainingBlockScoresResponse {
  block_id: string;
  start_date: string;
  end_date: string;
  scores: Record<string, unknown>[];
}

export async function getTrainingBlockScores(blockId: string): Promise<DailySafetyScore[]> {
  const raw = await apiFetch<TrainingBlockScoresResponse>(`/training-blocks/${blockId}/scores`);
  return raw.scores.map((item) => mapDailySafetyScoreFromApi(item));
}
