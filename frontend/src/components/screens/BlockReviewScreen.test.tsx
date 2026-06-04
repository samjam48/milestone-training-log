/**
 * BlockReviewScreen — route wiring and stack integration tests.
 * F10.6 — Review milestone badge in block review header
 *         (plans/tickets-phase-10-polish-2026-06-04.md).
 */

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../../App';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { ActivityLog, DailySafetyScore, ISODate, LoadPoint, TrainingBlock } from '../../types';
import { BlockReviewScreen } from './BlockReviewScreen';

vi.mock('../../hooks/useMilestoneEngine', () => ({
  useMilestoneEngine: () => mockEngine,
}));

const { getTrainingBlockReviewMock } = vi.hoisted(() => ({
  getTrainingBlockReviewMock: vi.fn(),
}));

vi.mock('../../lib/api/trainingBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/trainingBlocks')>();
  return {
    ...actual,
    getTrainingBlockReview: getTrainingBlockReviewMock,
  };
});

vi.mock('../../components/composites/CalendarHeatmap', () => ({
  CalendarHeatmap: ({
    startDate,
    endDate,
    scores,
  }: {
    startDate: ISODate;
    endDate: ISODate;
    scores: DailySafetyScore[];
  }) => (
    <div
      data-testid="calendar-heatmap"
      data-start-date={startDate}
      data-end-date={endDate}
      data-score-count={scores.length}
    />
  ),
}));

vi.mock('../../components/composites/WeeklyLoadGraph', () => ({
  WeeklyLoadGraph: ({
    startDate,
    endDate,
    series,
    threshold,
    flareUpDates,
  }: {
    startDate: ISODate;
    endDate: ISODate;
    series: LoadPoint[];
    threshold: number;
    flareUpDates: ISODate[];
  }) => (
    <div
      data-testid="weekly-load-graph"
      data-start-date={startDate}
      data-end-date={endDate}
      data-series-count={series.length}
      data-threshold={threshold}
      data-flare-count={flareUpDates.length}
    />
  ),
}));

const ACTIVE_BLOCK: TrainingBlock = {
  id: 'blk-active',
  userId: 'user-1',
  name: 'June Rehab Block',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  isReviewMilestoneHit: false,
  createdAt: '2026-06-01T00:00:00Z',
};

const PREVIOUS_BLOCK: TrainingBlock = {
  id: 'blk-prev-1',
  userId: 'user-1',
  name: 'May Rehab Block',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'completed',
  isReviewMilestoneHit: true,
  createdAt: '2026-05-01T00:00:00Z',
};

const REVIEW_RESPONSE = {
  block: PREVIOUS_BLOCK,
  dailyScores: [
    { date: '2026-05-01', state: 'safe', violations: [], hadFlareUp: false },
    { date: '2026-05-02', state: 'danger', violations: [], hadFlareUp: true },
  ] as DailySafetyScore[],
  loadSeries: [
    { date: '2026-05-01', load: 12, dailyLoad: 12 },
    { date: '2026-05-02', load: 18, dailyLoad: 6 },
  ] as LoadPoint[],
  flareUpDates: ['2026-05-02'] as ISODate[],
  totalSessions: 9,
  cleanDays: 7,
};

const ACTIVE_DAILY_SCORES: DailySafetyScore[] = [
  { date: '2026-06-01', state: 'safe', violations: [], hadFlareUp: false },
  { date: '2026-06-02', state: 'caution', violations: [], hadFlareUp: false },
  { date: '2026-06-03', state: 'neutral', violations: [], hadFlareUp: false },
];

const ACTIVE_LOAD_SERIES: LoadPoint[] = [
  { date: '2026-06-01', load: 10, dailyLoad: 10 },
  { date: '2026-06-02', load: 17, dailyLoad: 7 },
  { date: '2026-06-03', load: 20, dailyLoad: 3 },
];

const ACTIVE_FLARE_UP_DATES: ISODate[] = ['2026-06-02'];

const ACTIVE_LOGS: ActivityLog[] = [
  {
    id: 'log-active-1',
    userId: 'user-1',
    activityId: 'act-1',
    loggedDate: '2026-06-01',
    durationMinutes: 30,
    volumeValue: 120,
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  },
  {
    id: 'log-active-2',
    userId: 'user-1',
    activityId: 'act-2',
    loggedDate: '2026-06-02',
    durationMinutes: 45,
    volumeValue: 150,
    postActivityFeel: 'bad',
    createdAt: '2026-06-02T08:00:00Z',
    updatedAt: '2026-06-02T08:00:00Z',
  },
  {
    id: 'log-active-3',
    userId: 'user-1',
    activityId: 'act-3',
    loggedDate: '2026-06-03',
    durationMinutes: 25,
    volumeValue: 90,
    createdAt: '2026-06-03T08:00:00Z',
    updatedAt: '2026-06-03T08:00:00Z',
  },
];

function renderApp(): void {
  renderWithProviders(<App />);
}

async function openSettings(): Promise<void> {
  const user = userEvent.setup();
  await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Settings' }));
}

async function openActiveBlockReview(): Promise<void> {
  const user = userEvent.setup();
  await openSettings();
  await user.click(screen.getByRole('button', { name: 'Review' }));
}

async function openPreviousBlockReview(): Promise<void> {
  const user = userEvent.setup();
  await openSettings();
  await user.click(screen.getByRole('button', { name: 'View' }));
}

beforeEach(() => {
  resetMockEngine();
  getTrainingBlockReviewMock.mockReset();
  getTrainingBlockReviewMock.mockResolvedValue(REVIEW_RESPONSE);
  mockEngine.block = ACTIVE_BLOCK;
  mockEngine.previousBlocks = [PREVIOUS_BLOCK];
  mockEngine.logs = [];
  mockEngine.dailyScores = [];
  mockEngine.loadSeries = [];
  mockEngine.flareUpDates = [];
});

afterEach(() => {
  cleanup();
});

describe('BlockReviewScreen route wiring', () => {
  it('renders summary stats plus calendar and load charts for the active block', async () => {
    mockEngine.logs = ACTIVE_LOGS;
    mockEngine.dailyScores = ACTIVE_DAILY_SCORES;
    mockEngine.loadSeries = ACTIVE_LOAD_SERIES;
    mockEngine.flareUpDates = ACTIVE_FLARE_UP_DATES;

    renderApp();
    await openActiveBlockReview();

    const overlay = screen.getByTestId('stack-screen-overlay');
    const review = within(overlay);

    expect(review.getByRole('heading', { name: /block review/i })).toBeInTheDocument();
    expect(review.getByText(/^sessions$/i)).toBeInTheDocument();
    expect(review.getByText(/^clean days$/i)).toBeInTheDocument();
    expect(review.getByText(/^flares$/i)).toBeInTheDocument();
    expect(review.getByText('3')).toBeInTheDocument();
    expect(review.getByText('2')).toBeInTheDocument();
    expect(review.getByTestId('calendar-heatmap')).toHaveAttribute('data-score-count', '2');
    expect(review.getByTestId('weekly-load-graph')).toHaveAttribute('data-series-count', '3');
    expect(review.getByTestId('weekly-load-graph')).toHaveAttribute('data-flare-count', '1');
  });

  it('fetches review data for a previous block and renders the fetched charts and stats', async () => {
    getTrainingBlockReviewMock.mockResolvedValue(REVIEW_RESPONSE);

    renderApp();
    await openPreviousBlockReview();

    expect(getTrainingBlockReviewMock).toHaveBeenCalledWith(PREVIOUS_BLOCK.id);
    const overlay = screen.getByTestId('stack-screen-overlay');
    const review = within(overlay);
    expect(review.getByText('9')).toBeInTheDocument();
    expect(review.getByText('7')).toBeInTheDocument();
    expect(review.getByTestId('calendar-heatmap')).toHaveAttribute('data-score-count', '2');
    expect(review.getByTestId('weekly-load-graph')).toHaveAttribute('data-series-count', '2');
  });

  it('shows a loading state while the previous-block review is pending', async () => {
    let resolveReview: (value: typeof REVIEW_RESPONSE) => void = () => undefined;
    getTrainingBlockReviewMock.mockReturnValue(
      new Promise<typeof REVIEW_RESPONSE>((resolve) => {
        resolveReview = resolve;
      }),
    );

    renderApp();
    await openPreviousBlockReview();

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    resolveReview(REVIEW_RESPONSE);
  });

  it('shows an error state when the previous-block review request fails', async () => {
    getTrainingBlockReviewMock.mockRejectedValue(new Error('Unable to load block review'));

    renderApp();
    await openPreviousBlockReview();

    const overlay = screen.getByTestId('stack-screen-overlay');
    expect(within(overlay).getByRole('alert')).toHaveTextContent(/unable to load block review/i);
  });

  it('shows the empty state when there is no active block', async () => {
    mockEngine.block = {
      ...ACTIVE_BLOCK,
      id: '',
      name: '',
    };

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /block review/i })).toBeInTheDocument();
    expect(screen.getByText(/no review data/i)).toBeInTheDocument();
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
  });

  it('shows the empty state for an unknown block without fetching forever', () => {
    renderWithProviders(
      <BlockReviewScreen engine={mockEngine} blockId="unknown-block" onBack={vi.fn()} />,
    );

    expect(getTrainingBlockReviewMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/no review data/i)).toBeInTheDocument();
  });

  it('returns to settings when Back is clicked', async () => {
    renderApp();
    await openPreviousBlockReview();

    const overlay = screen.getByTestId('stack-screen-overlay');
    const review = within(overlay);
    expect(review.getByTestId('calendar-heatmap')).toBeInTheDocument();

    await userEvent.click(review.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    expect(screen.queryByTestId('stack-screen-overlay')).not.toBeInTheDocument();
  });
});

const REVIEW_MILESTONE_BADGE = /review milestone reached/i;

describe('BlockReviewScreen — F10.6 review milestone badge', () => {
  it('shows review milestone state in header for active block when isReviewMilestoneHit is true', async () => {
    mockEngine.block = { ...ACTIVE_BLOCK, isReviewMilestoneHit: true };
    mockEngine.logs = ACTIVE_LOGS;
    mockEngine.dailyScores = ACTIVE_DAILY_SCORES;
    mockEngine.loadSeries = ACTIVE_LOAD_SERIES;
    mockEngine.flareUpDates = ACTIVE_FLARE_UP_DATES;

    renderApp();
    await openActiveBlockReview();

    const review = within(screen.getByTestId('stack-screen-overlay'));
    expect(review.getByText(REVIEW_MILESTONE_BADGE)).toBeInTheDocument();
  });

  it('does not show review milestone badge in header when active block isReviewMilestoneHit is false', async () => {
    mockEngine.block = { ...ACTIVE_BLOCK, isReviewMilestoneHit: false };
    mockEngine.logs = ACTIVE_LOGS;
    mockEngine.dailyScores = ACTIVE_DAILY_SCORES;
    mockEngine.loadSeries = ACTIVE_LOAD_SERIES;
    mockEngine.flareUpDates = ACTIVE_FLARE_UP_DATES;

    renderApp();
    await openActiveBlockReview();

    const review = within(screen.getByTestId('stack-screen-overlay'));
    expect(review.queryByText(REVIEW_MILESTONE_BADGE)).not.toBeInTheDocument();
  });

  it('shows review milestone state in header for previous block from review payload', async () => {
    renderApp();
    await openPreviousBlockReview();

    const review = within(screen.getByTestId('stack-screen-overlay'));
    expect(review.getByText(REVIEW_MILESTONE_BADGE)).toBeInTheDocument();
  });

  it('does not show review milestone badge when fetched block has isReviewMilestoneHit false', async () => {
    getTrainingBlockReviewMock.mockResolvedValue({
      ...REVIEW_RESPONSE,
      block: { ...PREVIOUS_BLOCK, isReviewMilestoneHit: false },
    });

    renderApp();
    await openPreviousBlockReview();

    const review = within(screen.getByTestId('stack-screen-overlay'));
    expect(review.queryByText(REVIEW_MILESTONE_BADGE)).not.toBeInTheDocument();
  });

  it('shows review milestone in header when BlockReviewScreen is rendered directly for active block', () => {
    mockEngine.block = { ...ACTIVE_BLOCK, isReviewMilestoneHit: true };
    mockEngine.logs = ACTIVE_LOGS;
    mockEngine.dailyScores = ACTIVE_DAILY_SCORES;
    mockEngine.loadSeries = ACTIVE_LOAD_SERIES;

    renderWithProviders(<BlockReviewScreen engine={mockEngine} onBack={vi.fn()} />);

    expect(screen.getByText(REVIEW_MILESTONE_BADGE)).toBeInTheDocument();
  });
});
