import type { DailySafetyScore, ISODate, TrainingBlock } from '../../types';
import type { LoadPoint } from '../load';
import { apiFetch, apiFetchOrNullOn404 } from './client';
import {
  mapTrainingBlockCreateBody,
  mapTrainingBlockFromApi,
  mapTrainingBlockPatchBody,
  mapDailySafetyScoreFromApi,
  mapLoadPointFromApi,
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

interface TrainingBlockReviewResponse {
  block: Record<string, unknown>;
  daily_scores: Record<string, unknown>[];
  load_series: Record<string, unknown>[];
  flare_up_dates: string[];
  total_sessions: number;
  clean_days: number;
}

export interface TrainingBlockReview {
  block: TrainingBlockRead;
  dailyScores: DailySafetyScore[];
  loadSeries: LoadPoint[];
  flareUpDates: ISODate[];
  totalSessions: number;
  cleanDays: number;
}

export async function getTrainingBlockReview(blockId: string): Promise<TrainingBlockReview> {
  const raw = await apiFetch<TrainingBlockReviewResponse>(
    `/training-blocks/${blockId}/review`,
  );
  return {
    block: mapTrainingBlockFromApi(raw.block),
    dailyScores: raw.daily_scores.map((item) => mapDailySafetyScoreFromApi(item)),
    loadSeries: raw.load_series.map((item) => mapLoadPointFromApi(item)),
    flareUpDates: raw.flare_up_dates.map((date) => String(date) as ISODate),
    totalSessions: raw.total_sessions,
    cleanDays: raw.clean_days,
  };
}
