// =============================================================================
// BlockReviewScreen — F3.0 block review overlay
// =============================================================================

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarHeatmap } from '../composites/CalendarHeatmap';
import { getTrainingBlockScores } from '../../lib/api/trainingBlocks';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { DailySafetyScore, TrainingBlock, ISODate } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BlockReviewScreenProps {
  engine: MilestoneEngineResult;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRange(startDate: string, endDate: string | undefined): string {
  const fmt = (iso: string): string =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : `Started ${fmt(startDate)}`;
}

// ---------------------------------------------------------------------------
// PreviousBlockPage — one page per previous block, fetches its own scores
// ---------------------------------------------------------------------------

interface PreviousBlockPageProps {
  block: TrainingBlock;
}

const PreviousBlockPage: React.FC<PreviousBlockPageProps> = ({ block }) => {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['block-scores', block.id],
    queryFn: () => getTrainingBlockScores(block.id),
  });

  return (
    <div
      className="min-w-[100vw] shrink-0 flex flex-col p-4"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{block.name}</h2>
        <p className="text-sm text-gray-500">
          {formatDateRange(block.startDate, block.endDate)}
        </p>
      </div>

      {isPending && (
        <div
          data-testid="block-scores-loading"
          aria-busy="true"
          className="skeleton h-40 w-full rounded-lg bg-gray-100 animate-pulse"
        />
      )}

      {isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-red-600">Could not load scores</p>
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className="px-4 py-2 rounded-md bg-gray-100 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {!isPending && !isError && (
        <CalendarHeatmap
          startDate={block.startDate as ISODate}
          endDate={(block.endDate ?? block.startDate) as ISODate}
          scores={(data ?? []) as DailySafetyScore[]}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// BlockReviewScreen
// ---------------------------------------------------------------------------

export const BlockReviewScreen: React.FC<BlockReviewScreenProps> = ({ engine, onBack }) => {
  const { block, dailyScores, previousBlocks, todayDate } = engine;

  const hasBlock = block.id !== '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600"
        >
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M12.5 15l-5-5 5-5"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <h1 className="text-base font-semibold">Block Review</h1>
      </div>

      {/* Body */}
      {!hasBlock ? (
        <div
          data-testid="block-review-empty"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
        >
          <p className="text-sm text-gray-500">No active training block</p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-md bg-gray-100 text-sm font-medium"
          >
            Go back
          </button>
        </div>
      ) : (
        <div
          data-testid="block-review-scroll"
          className="flex flex-1 overflow-x-scroll"
          style={{ scrollSnapType: 'x mandatory', overflowX: 'scroll' }}
        >
          {/* Active block page */}
          <div
            className="min-w-[100vw] shrink-0 flex flex-col p-4"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{block.name}</h2>
              <p className="text-sm text-gray-500">
                {formatDateRange(block.startDate, block.endDate ?? todayDate)}
              </p>
            </div>
            <CalendarHeatmap
              startDate={block.startDate as ISODate}
              endDate={(block.endDate ?? todayDate) as ISODate}
              scores={dailyScores as DailySafetyScore[]}
            />
          </div>

          {/* Previous block pages */}
          {previousBlocks.map((prevBlock) => (
            <PreviousBlockPage key={prevBlock.id} block={prevBlock} />
          ))}
        </div>
      )}
    </div>
  );
};
