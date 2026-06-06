/**
 * S25.F2 — GoalsCard composite tests (written before implementation).
 *
 * Covers: numeric fill bar width from fill_ratio; qualitative status pill;
 * achieved row subdued styling; hide when goalRows is empty.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  goalDashboardRowAchieved,
  goalDashboardRowNumeric,
  goalDashboardRowQualitative,
  type GoalDashboardRow,
} from '../../test/goalDashboardRowFixtures';
import { GoalsCard } from './GoalsCard';

function progressFillWidth(row: HTMLElement): string {
  const bar = within(row).getByRole('progressbar');
  const fill = bar.querySelector<HTMLElement>('[style*="width"]');
  if (fill == null) {
    throw new Error('Expected progress bar fill element with inline width');
  }
  return fill.style.width;
}

function renderGoalsCard(goalRows: GoalDashboardRow[]) {
  return renderWithProviders(<GoalsCard goalRows={goalRows} />);
}

afterEach(() => {
  cleanup();
});

describe('GoalsCard — S25.F2 numeric fill bar', () => {
  it('sets progress bar fill width from fill_ratio (40% for ratio 0.4)', () => {
    renderGoalsCard([goalDashboardRowNumeric]);

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowNumeric.goalId}`);
    expect(progressFillWidth(row)).toBe('40%');
    expect(within(row).getByText(goalDashboardRowNumeric.title)).toBeInTheDocument();
  });

  it('caps fill width at 100% when fill_ratio exceeds 1', () => {
    const overflowRow: GoalDashboardRow = {
      ...goalDashboardRowNumeric,
      goalId: 'goal-row-overflow',
      fillRatio: 1.35,
    };

    renderGoalsCard([overflowRow]);

    const row = screen.getByTestId(`goals-card-row-${overflowRow.goalId}`);
    expect(progressFillWidth(row)).toBe('100%');
  });
});

describe('GoalsCard — S25.F2 qualitative status pill', () => {
  it('renders a status pill instead of a progress bar for qualitative goals', () => {
    renderGoalsCard([goalDashboardRowQualitative]);

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowQualitative.goalId}`);
    expect(within(row).getByTestId('goals-card-status-pill')).toHaveTextContent(/active/i);
    expect(within(row).queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('GoalsCard — S25.F2 achieved row subdued', () => {
  it('renders achieved goals with subdued styling while still visible', () => {
    renderGoalsCard([goalDashboardRowAchieved]);

    const row = screen.getByTestId(`goals-card-row-${goalDashboardRowAchieved.goalId}`);
    expect(row).toHaveAttribute('data-achieved', 'true');
    expect(row.className).toMatch(/opacity-|text-ink-muted|text-ink-faint/);
    expect(within(row).getByText(goalDashboardRowAchieved.title)).toBeInTheDocument();
  });
});

describe('GoalsCard — S25.F2 empty state', () => {
  it('renders nothing when goalRows is empty', () => {
    const { container } = renderGoalsCard([]);

    expect(screen.queryByTestId('goals-card')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('GoalsCard — section chrome', () => {
  it('renders a Goals section label and card wrapper when rows exist', () => {
    renderGoalsCard([goalDashboardRowNumeric]);

    expect(screen.getByTestId('goals-card')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
  });
});
