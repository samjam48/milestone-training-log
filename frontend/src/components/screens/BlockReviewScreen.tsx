import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { CalendarHeatmap } from '../composites/CalendarHeatmap';
import { WeeklyLoadGraph } from '../composites/WeeklyLoadGraph';
import { Card } from '../ui/Card';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import { getTrainingBlockReview } from '../../lib/api/trainingBlocks';
import type { TrainingBlockReview } from '../../lib/api/trainingBlocks';
import type { ActivityLog, DailySafetyScore, ISODate, TrainingBlock } from '../../types';
import type { LoadPoint } from '../../lib/load';

interface BlockReviewScreenProps {
  engine: MilestoneEngineResult;
  onBack: () => void;
  blockId?: string;
}

interface ReviewBlock {
  id: string;
  name: string;
  startDate: ISODate;
  endDate?: ISODate;
  status: TrainingBlock['status'];
}

interface ReviewData {
  block: ReviewBlock;
  dailyScores: DailySafetyScore[];
  loadSeries: LoadPoint[];
  flareUpDates: ISODate[];
  totalSessions: number;
  cleanDays: number;
}

interface StatBoxProps {
  label: string;
  value: number;
  intent?: 'neutral' | 'safe' | 'danger';
}

function formatDate(date: ISODate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function countCleanLogs(logs: ActivityLog[]): number {
  return logs.filter(
    (log) =>
      log.postActivityFeel !== 'bad' &&
      !(log.ruleViolationsAtLog ?? []).some((violation) => violation.severity === 'danger'),
  ).length;
}

function logsInBlock(logs: ActivityLog[], block: ReviewBlock): ActivityLog[] {
  const endDate = block.endDate;
  return logs.filter(
    (log) =>
      log.loggedDate >= block.startDate &&
      (endDate === undefined || log.loggedDate <= endDate),
  );
}

function activeReviewData(engine: MilestoneEngineResult): ReviewData | null {
  const block = engine.block;
  if (block.id === '') return null;

  const blockLogs = logsInBlock(engine.logs, block);
  return {
    block,
    dailyScores: engine.dailyScores,
    loadSeries: engine.loadSeries,
    flareUpDates: engine.flareUpDates,
    totalSessions: blockLogs.length,
    cleanDays: countCleanLogs(blockLogs),
  };
}

function fetchedReviewData(review: TrainingBlockReview | undefined): ReviewData | null {
  if (review === undefined) return null;
  return {
    block: review.block,
    dailyScores: review.dailyScores,
    loadSeries: review.loadSeries,
    flareUpDates: review.flareUpDates,
    totalSessions: review.totalSessions,
    cleanDays: review.cleanDays,
  };
}

function hasReviewContent(data: ReviewData): boolean {
  return (
    data.dailyScores.length > 0 ||
    data.loadSeries.length > 0 ||
    data.flareUpDates.length > 0 ||
    data.totalSessions > 0 ||
    data.cleanDays > 0
  );
}

function StatBox({ label, value, intent = 'neutral' }: StatBoxProps): React.ReactElement {
  const colorClass =
    intent === 'safe'
      ? 'text-safe-fg'
      : intent === 'danger'
        ? 'text-danger-fg'
        : 'text-ink';

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 py-1 text-center">
      <span className={`font-metric text-[34px] leading-none tabular-nums ${colorClass}`}>
        {value}
      </span>
      <span className="text-caption text-ink-muted">{label}</span>
    </div>
  );
}

export function BlockReviewScreen({
  engine,
  onBack,
  blockId,
}: BlockReviewScreenProps): React.ReactElement {
  const activeBlockId = engine.block.id !== '' ? engine.block.id : undefined;
  const isActiveRequest = blockId === undefined || blockId === activeBlockId;
  const previousBlock = blockId === undefined
    ? undefined
    : engine.previousBlocks.find((block) => block.id === blockId);

  const reviewQuery = useQuery({
    queryKey: ['block-review', blockId],
    queryFn: () => getTrainingBlockReview(blockId as string),
    enabled: blockId !== undefined && previousBlock !== undefined && !isActiveRequest,
  });
  const isReviewFetchEnabled =
    blockId !== undefined && previousBlock !== undefined && !isActiveRequest;

  const reviewData = isActiveRequest
    ? activeReviewData(engine)
    : fetchedReviewData(reviewQuery.data);

  const isUnknownBlock =
    blockId !== undefined && !isActiveRequest && previousBlock === undefined;

  let body: React.ReactNode;
  if (isUnknownBlock || reviewData === null && !isReviewFetchEnabled) {
    body = <EmptyState />;
  } else if (isReviewFetchEnabled && reviewQuery.isPending) {
    body = (
      <Card pad="md">
        <p role="status" className="py-6 text-center text-body-md text-ink-muted">
          Loading block review...
        </p>
      </Card>
    );
  } else if (isReviewFetchEnabled && reviewQuery.isError) {
    body = (
      <Card pad="md">
        <p role="alert" className="py-6 text-center text-body-md text-danger-fg">
          Unable to load block review.
        </p>
      </Card>
    );
  } else if (reviewData === null) {
    body = <EmptyState />;
  } else if (!hasReviewContent(reviewData)) {
    body = isActiveRequest ? (
      <ReviewContent
        data={reviewData}
        endDate={reviewData.block.endDate ?? engine.todayDate}
        threshold={engine.weekLoadThreshold}
      />
    ) : (
      <EmptyState />
    );
  } else {
    body = (
      <ReviewContent
        data={reviewData}
        endDate={reviewData.block.endDate ?? engine.todayDate}
        threshold={engine.weekLoadThreshold}
      />
    );
  }

  const titleBlock = reviewData?.block ?? previousBlock ?? engine.block;
  const displayEndDate = titleBlock.endDate ?? engine.todayDate;

  return (
    <section className="flex min-h-full flex-1 flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line px-4 py-2 text-body-sm font-semibold text-ink transition-colors duration-snap hover:bg-bg-raised"
        >
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-title-lg font-semibold text-ink">Block review</h1>
          {titleBlock.id !== '' ? (
            <p className="mt-0.5 truncate text-caption text-ink-muted">
              {titleBlock.name} · {formatDate(titleBlock.startDate)} -{' '}
              {formatDate(displayEndDate)}
            </p>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 pb-10">
        {body}
      </div>
    </section>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <Card pad="md">
      <p className="py-6 text-center text-body-md text-ink-muted">
        No review data is available for this block yet.
      </p>
    </Card>
  );
}

interface ReviewContentProps {
  data: ReviewData;
  endDate: ISODate;
  threshold: number;
}

function ReviewContent({
  data,
  endDate,
  threshold,
}: ReviewContentProps): React.ReactElement {
  const scoredDays = data.dailyScores.filter((score) => score.state !== 'neutral');
  const safeDays = data.dailyScores.filter((score) => score.state === 'safe').length;
  const flareCount = data.flareUpDates.length;

  return (
    <>
      <Card pad="md">
        <div className="grid grid-cols-4 gap-2 divide-x divide-line">
          <StatBox label="Sessions" value={data.totalSessions} />
          <StatBox label="Clean days" value={data.cleanDays} intent="safe" />
          <StatBox label="Safe days" value={safeDays} intent="safe" />
          <StatBox
            label="Flares"
            value={flareCount}
            intent={flareCount > 0 ? 'danger' : 'neutral'}
          />
        </div>
      </Card>
      <CalendarHeatmap
        startDate={data.block.startDate}
        endDate={endDate}
        scores={scoredDays}
        title="Safety map"
      />
      <WeeklyLoadGraph
        startDate={data.block.startDate}
        endDate={endDate}
        series={data.loadSeries}
        threshold={threshold}
        flareUpDates={data.flareUpDates}
        title="Foot load"
        subtitle="Rolling 7-day load across the block"
      />
    </>
  );
}
