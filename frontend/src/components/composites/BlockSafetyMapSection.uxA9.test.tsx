/**
 * UX-A9 — Block safety map: legend and summary
 *
 * Tests are intentionally failing until production code is updated:
 *   1. Section heading changed from "Block Safety Map" → "Block Progress"
 *   2. Summary line "N / D days without issues" added above the heatmap
 *   3. 3-item legend (safe / caution / danger) added below the heatmap
 *   4. Legend uses the same colour tokens exported from CalendarHeatmap (single source)
 *   5. No active block → summary and legend not rendered
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { DailySafetyScore } from '../../types';
import { BlockSafetyMapSection } from './BlockSafetyMapSection';

// ---------------------------------------------------------------------------
// Mock CalendarHeatmap so rendering is fast and side-effect-free
// ---------------------------------------------------------------------------

vi.mock('./CalendarHeatmap', () => ({
  CalendarHeatmap: ({
    startDate,
    endDate,
    scores,
  }: {
    startDate: string;
    endDate: string;
    scores: DailySafetyScore[];
  }) => (
    <div
      data-testid="calendar-heatmap"
      data-start={startDate}
      data-end={endDate}
      data-score-count={scores.length}
    />
  ),
  SAFETY_CELL_CLASSES: {
    safe:    'bg-safe/70 ring-1 ring-inset ring-safe-border',
    caution: 'bg-caution/70 ring-1 ring-inset ring-caution-border',
    danger:  'bg-danger/70 ring-1 ring-inset ring-danger-border',
  },
}));

// ---------------------------------------------------------------------------
// Mock useQuery — active block page renders from engine.dailyScores directly
// (no network call needed for the active block)
// ---------------------------------------------------------------------------

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_BLOCK_NO_END = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'June Block',
  startDate: '2026-06-01',
  endDate: undefined as string | undefined,
  status: 'active' as const,
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

/** 5 safe, 2 caution, 1 danger across 8 days */
const EIGHT_DAY_SCORES: DailySafetyScore[] = [
  { date: '2026-06-01', state: 'safe',    violations: [], hadFlareUp: false },
  { date: '2026-06-02', state: 'safe',    violations: [], hadFlareUp: false },
  { date: '2026-06-03', state: 'caution', violations: [], hadFlareUp: false },
  { date: '2026-06-04', state: 'safe',    violations: [], hadFlareUp: false },
  { date: '2026-06-05', state: 'danger',  violations: [], hadFlareUp: true  },
  { date: '2026-06-06', state: 'safe',    violations: [], hadFlareUp: false },
  { date: '2026-06-07', state: 'caution', violations: [], hadFlareUp: false },
  { date: '2026-06-08', state: 'safe',    violations: [], hadFlareUp: false },
];

/** 3 safe out of 3 days */
const THREE_DAY_ALL_SAFE: DailySafetyScore[] = [
  { date: '2026-06-01', state: 'safe', violations: [], hadFlareUp: false },
  { date: '2026-06-02', state: 'safe', violations: [], hadFlareUp: false },
  { date: '2026-06-03', state: 'safe', violations: [], hadFlareUp: false },
];

function setupActiveBlock(scores: DailySafetyScore[]) {
  mockEngine.block = { ...ACTIVE_BLOCK_NO_END, endDate: undefined };
  mockEngine.dailyScores = scores;
  mockEngine.previousBlocks = [];
  mockEngine.todayDate = '2026-06-08';
  // useQuery is not called for the active block page — return a stub
  useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC1 / AC3 — summary line renders "N / D days without issues"; D = actual day count
// ---------------------------------------------------------------------------

describe('UX-A9 — summary line', () => {
  it('AC1+AC3: renders "N / D days without issues" where D equals the number of scored days', () => {
    // 8 scored days → D should be 8, N = 5 safe days
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    // The text must appear; exact format: "5 / 8 days without issues"
    expect(screen.getByText(/5\s*\/\s*8 days without issues/i)).toBeInTheDocument();
  });

  it('AC3: summary denominator changes when the period has a different number of days (not hardcoded 14)', () => {
    // Only 3 days — denominator must be 3, not 14
    setupActiveBlock(THREE_DAY_ALL_SAFE);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.getByText(/3\s*\/\s*3 days without issues/i)).toBeInTheDocument();
    // Confirm it does NOT say "/ 14"
    expect(screen.queryByText(/\/\s*14 days without issues/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC2 — N counts only safe days
// ---------------------------------------------------------------------------

describe('UX-A9 — N counts only safe days', () => {
  it('AC2: caution and danger days are not counted as safe', () => {
    // 5 safe, 2 caution, 1 danger → N = 5
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.getByText(/5\s*\/\s*8 days without issues/i)).toBeInTheDocument();
    // Sanity: 8 (all days) and 7 (safe+caution) would both be wrong for N
    expect(screen.queryByText(/8\s*\/\s*8 days without issues/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/7\s*\/\s*8 days without issues/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC4 — legend renders 3 items: safe / caution / danger
// ---------------------------------------------------------------------------

describe('UX-A9 — legend', () => {
  it('AC4: renders legend items labelled "safe", "caution", and "danger"', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    // Each label must appear as accessible text (case-insensitive)
    expect(screen.getByText(/^safe$/i)).toBeInTheDocument();
    expect(screen.getByText(/^caution$/i)).toBeInTheDocument();
    expect(screen.getByText(/^danger$/i)).toBeInTheDocument();
  });

  it('AC4: legend container has exactly 3 legend items', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const legend = screen.getByTestId('block-safety-legend');
    expect(legend.children).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC5 — legend colour tokens match heatmap cells (single source of truth)
//
// The implementation should export or re-use a shared SAFETY_CELL_CLASSES
// constant (or equivalent) so legend swatches carry the same Tailwind classes
// as heatmap cells. We verify this by checking that each legend swatch
// element carries the expected class substrings that come from those tokens.
// ---------------------------------------------------------------------------

describe('UX-A9 — legend colour tokens match heatmap cells', () => {
  it('AC5: safe legend swatch carries bg-safe class', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const safeSwatch = screen.getByTestId('legend-swatch-safe');
    expect(safeSwatch.className).toMatch(/bg-safe/);
  });

  it('AC5: caution legend swatch carries bg-caution class', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const cautionSwatch = screen.getByTestId('legend-swatch-caution');
    expect(cautionSwatch.className).toMatch(/bg-caution/);
  });

  it('AC5: danger legend swatch carries bg-danger class', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const dangerSwatch = screen.getByTestId('legend-swatch-danger');
    expect(dangerSwatch.className).toMatch(/bg-danger/);
  });
});

// ---------------------------------------------------------------------------
// AC6 — section heading reads "Block Progress"
// ---------------------------------------------------------------------------

describe('UX-A9 — section heading', () => {
  it('AC6: section heading text is "Block Progress"', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.getByText(/block progress/i)).toBeInTheDocument();
  });

  it('AC6: old heading "Block Safety Map" is no longer rendered', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.queryByText(/block safety map/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC7 — no active block → summary and legend do NOT render
// ---------------------------------------------------------------------------

describe('UX-A9 — no active block', () => {
  it('AC7: component returns null when block.id is empty (existing behaviour)', () => {
    // block.id === '' triggers the early return in the existing code
    mockEngine.block = { ...ACTIVE_BLOCK_NO_END, id: '', name: '', startDate: '' };
    mockEngine.dailyScores = [];
    useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });

    const { container } = renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(container.firstChild).toBeNull();
  });

  it('AC7: "0 / 0 days without issues" is never shown when there is no active block', () => {
    mockEngine.block = { ...ACTIVE_BLOCK_NO_END, id: '', name: '', startDate: '' };
    mockEngine.dailyScores = [];
    useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.queryByText(/0\s*\/\s*0 days without issues/i)).not.toBeInTheDocument();
  });

  it('AC7: legend is not rendered when there is no active block', () => {
    mockEngine.block = { ...ACTIVE_BLOCK_NO_END, id: '', name: '', startDate: '' };
    mockEngine.dailyScores = [];
    useQueryMock.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch: vi.fn() });

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.queryByTestId('block-safety-legend')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC8 — existing heatmap behaviour unchanged
// ---------------------------------------------------------------------------

describe('UX-A9 — existing heatmap behaviour preserved', () => {
  it('AC8: CalendarHeatmap still renders with correct startDate, endDate, and scores', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    const heatmap = screen.getByTestId('calendar-heatmap');
    expect(heatmap).toBeInTheDocument();
    expect(heatmap).toHaveAttribute('data-start', ACTIVE_BLOCK_NO_END.startDate);
    expect(heatmap).toHaveAttribute('data-score-count', String(EIGHT_DAY_SCORES.length));
  });

  it('AC8: block-safety-map-scroll container still present', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.getByTestId('block-safety-map-scroll')).toBeInTheDocument();
  });

  it('AC8: active block name is still shown in the header', () => {
    setupActiveBlock(EIGHT_DAY_SCORES);

    renderWithProviders(<BlockSafetyMapSection engine={mockEngine} />);

    expect(screen.getByText('June Block')).toBeInTheDocument();
  });
});
