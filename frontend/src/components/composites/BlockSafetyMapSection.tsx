// =============================================================================
// BlockSafetyMapSection — F3.0-fix: inline block safety map for DashboardScreen
// =============================================================================

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarHeatmap } from './CalendarHeatmap';
import { SAFETY_CELL_CLASSES } from './safetyCellClasses';
import { getTrainingBlockReview } from '../../lib/api/trainingBlocks';
import type { MilestoneEngineResult } from '../../hooks/useMilestoneEngine';
import type { DailySafetyScore, TrainingBlock, ISODate } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BlockSafetyMapSectionProps {
  engine: MilestoneEngineResult;
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
// PreviousBlockPage — one page per previous block, fetches review daily scores
// ---------------------------------------------------------------------------

interface PreviousBlockPageProps {
  block: TrainingBlock;
}

const PreviousBlockPage: React.FC<PreviousBlockPageProps> = ({ block }) => {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['block-review', block.id],
    queryFn: () => getTrainingBlockReview(block.id),
  });

  return (
    <div
      className="min-w-full shrink-0 flex flex-col p-4"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="mb-4">
        <h2 className="text-body-lg font-semibold text-ink">{block.name}</h2>
        <p className="text-caption text-ink-muted">
          {formatDateRange(block.startDate, block.endDate)}
        </p>
      </div>

      {isPending && (
        <div
          data-testid="block-review-loading"
          aria-busy="true"
          className="skeleton h-40 w-full rounded-lg bg-bg-sunken animate-pulse"
        />
      )}

      {isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-8">
          <p className="text-caption text-danger-fg">Could not load block review</p>
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className="px-4 py-2 rounded-md bg-bg-sunken text-body font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {!isPending && !isError && (
        <CalendarHeatmap
          startDate={block.startDate as ISODate}
          endDate={(block.endDate ?? block.startDate) as ISODate}
          scores={(data?.dailyScores ?? []) as DailySafetyScore[]}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// BlockSafetyMapSection
// ---------------------------------------------------------------------------

export const BlockSafetyMapSection: React.FC<BlockSafetyMapSectionProps> = ({ engine }) => {
  const { block, dailyScores, previousBlocks, todayDate } = engine;

  if (block.id === '') {
    return null;
  }

  const safeDayCount = dailyScores.filter((s) => s.state === 'safe').length;
  const totalDayCount = dailyScores.length;

  return (
    <div>
      <p className="text-label uppercase font-medium text-ink-muted mb-2">Block Progress</p>
      <p className="text-caption text-ink-muted mb-2">
        {safeDayCount} / {totalDayCount} days without issues
      </p>
      <div
        data-testid="block-safety-map-scroll"
        className="flex overflow-x-scroll"
        style={{ scrollSnapType: 'x mandatory', overflowX: 'scroll' }}
      >
        {/* Active block page */}
        <div
          className="min-w-full shrink-0 flex flex-col p-4"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className="mb-4">
            <h2 className="text-body-lg font-semibold text-ink">{block.name}</h2>
            <p className="text-caption text-ink-muted">
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
      <div
        data-testid="block-safety-legend"
        className="flex items-center gap-4 mt-2 px-4"
      >
        <div className="flex items-center gap-1">
          <span data-testid="legend-swatch-safe" className={`inline-block w-3 h-3 rounded-sm ${SAFETY_CELL_CLASSES.safe}`} />
          <span className="text-caption text-ink-muted">Safe</span>
        </div>
        <div className="flex items-center gap-1">
          <span data-testid="legend-swatch-caution" className={`inline-block w-3 h-3 rounded-sm ${SAFETY_CELL_CLASSES.caution}`} />
          <span className="text-caption text-ink-muted">Caution</span>
        </div>
        <div className="flex items-center gap-1">
          <span data-testid="legend-swatch-danger" className={`inline-block w-3 h-3 rounded-sm ${SAFETY_CELL_CLASSES.danger}`} />
          <span className="text-caption text-ink-muted">Danger</span>
        </div>
      </div>
    </div>
  );
};
