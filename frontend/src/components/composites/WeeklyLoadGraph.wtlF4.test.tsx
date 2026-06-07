/**
 * WTL.F4 — Dashboard load-tax graph component (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F4
 *
 * Covers: 30-day series rendering, effort-load subtitle, no /0 metric,
 * nullable cap UI, formula copy, and preserved flare-up markers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  WTL_F4_FLARE_DATE,
  WTL_F4_FORMULA_COPY,
  WTL_F4_GRAPH_START,
  WTL_F4_LATEST_LOAD,
  WTL_F4_SUBTITLE,
  buildWtlF4LoadSeries,
  wtlF4LoadSeries,
} from '../../test/wtlF4LoadGraphFixtures';
import { WeeklyLoadGraph } from './WeeklyLoadGraph';

afterEach(() => {
  cleanup();
});

function graphCard(): HTMLElement {
  const title = screen.getByRole('heading', { name: 'Foot load' });
  const card = title.closest('.rounded-lg') as HTMLElement | null;
  if (card == null) {
    throw new Error('Expected WeeklyLoadGraph card root');
  }
  return card;
}

describe('WeeklyLoadGraph — WTL.F4 load-tax graph', () => {
  it('plots all 30 days in the load-tax series', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={null as unknown as number}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    const chart = screen.getByRole('img', {
      name: /7-day rolling load from 2026-05-09 to 2026-06-07/i,
    });
    expect(chart.querySelectorAll('circle[stroke-width="1"]').length).toBe(30);
  });

  it('renders the rolling effort-load subtitle when provided', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={null as unknown as number}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    expect(screen.getByText(WTL_F4_SUBTITLE)).toBeInTheDocument();
  });

  it('shows the latest rolling load-tax value without a / 0 cap suffix when threshold is null', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={null as unknown as number}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    const card = graphCard();
    expect(within(card).getByText(String(WTL_F4_LATEST_LOAD))).toBeInTheDocument();
    expect(within(card).queryByText(/\/\s*0/)).not.toBeInTheDocument();
  });

  it('hides cap line, cap label, and weekly cap legend when threshold is null', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={null as unknown as number}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    expect(screen.queryByText(/^cap$/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly cap')).not.toBeInTheDocument();
  });

  it('renders cap UI when an explicit load-tax threshold is present', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={150}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    expect(screen.getByText(/^cap$/i)).toBeInTheDocument();
    expect(screen.getByText('Weekly cap')).toBeInTheDocument();
    expect(screen.getByText(/\/\s*150/)).toBeInTheDocument();
  });

  it('explains the load-tax formula in graph copy or tooltip', () => {
    renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={wtlF4LoadSeries}
        threshold={null as unknown as number}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    expect(
      screen.getByText(new RegExp(WTL_F4_FORMULA_COPY, 'i')),
    ).toBeInTheDocument();
  });

  it('preserves flare-up markers on flagged days in the series', () => {
    const { container } = renderWithProviders(
      <WeeklyLoadGraph
        startDate={WTL_F4_GRAPH_START}
        endDate="2026-06-07"
        series={buildWtlF4LoadSeries()}
        threshold={null as unknown as number}
        flareUpDates={[WTL_F4_FLARE_DATE]}
        title="Foot load"
        subtitle={WTL_F4_SUBTITLE}
      />,
    );

    const flareTitle = container.querySelector('title');
    expect(flareTitle?.textContent).toBe(`Flare-up logged on ${WTL_F4_FLARE_DATE}`);
    expect(screen.getByText('Flare-up')).toBeInTheDocument();
  });
});
