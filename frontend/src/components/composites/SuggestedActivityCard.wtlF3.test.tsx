/**
 * WTL.F3 — Weekly target suggestions UI copy (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F3
 *
 * Covers: Do cards show activity + remaining amount, completed targets absent
 * from Do, no noisy Done rows, rest override copy, and multiple-target ordering.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import {
  wtlF3BikeDoCaution,
  wtlF3BikeDoIncomplete,
  wtlF3WalkDoIncomplete,
  wtlF3WalkDoneLoggedToday,
  wtlF3WalkRestOverride,
  wtlF3OnlyBikeDoBuckets,
} from '../../test/wtlF3SuggestionFixtures';
import { SuggestedActivityCard } from './SuggestedActivityCard';

afterEach(() => {
  cleanup();
});

function doSection(): HTMLElement {
  return screen.getByTestId('suggestion-section-do');
}

function restSection(): HTMLElement {
  return screen.getByTestId('suggestion-section-rest');
}

describe('SuggestedActivityCard — WTL.F3 weekly target Do copy', () => {
  it('shows activity name and remaining weekly target amount in Do rows', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[wtlF3WalkDoIncomplete]} />,
    );

    const section = doSection();
    expect(within(section).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(section).getByText(/3\.5 km left this week/i)).toBeInTheDocument();
  });

  it('shows sessions remaining copy for session-based weekly targets', () => {
    const sessionsDo = {
      ...wtlF3WalkDoIncomplete,
      reason: '2 sessions left this week',
    };

    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[sessionsDo]} />,
    );

    const section = doSection();
    expect(within(section).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(section).getByText(/2 sessions left this week/i)).toBeInTheDocument();
  });

  it('keeps completed weekly targets out of the Do section', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={wtlF3OnlyBikeDoBuckets} />,
    );

    const section = doSection();
    expect(within(section).getByText('Stationary Bike')).toBeInTheDocument();
    expect(within(section).queryByText('Morning Walk')).not.toBeInTheDocument();
  });

  it('does not render a Done section when completed targets were not logged today', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={wtlF3OnlyBikeDoBuckets} />,
    );

    expect(screen.queryByTestId('suggestion-section-done')).not.toBeInTheDocument();
    expect(screen.queryByText('Morning Walk')).not.toBeInTheDocument();
  });

  it('renders Done today only when the activity was logged today', () => {
    renderWithProviders(
      <SuggestedActivityCard
        suggestionBuckets={[wtlF3WalkDoneLoggedToday, wtlF3BikeDoIncomplete]}
      />,
    );

    expect(screen.getByTestId('suggestion-section-done')).toBeInTheDocument();
    expect(within(doSection()).queryByText('Morning Walk')).not.toBeInTheDocument();
    expect(screen.getByText('Morning Walk')).toBeInTheDocument();
  });

  it('sorts multiple incomplete weekly targets with safe rows before caution rows', () => {
    renderWithProviders(
      <SuggestedActivityCard
        suggestionBuckets={[wtlF3BikeDoCaution, wtlF3WalkDoIncomplete]}
      />,
    );

    const rows = within(doSection()).getAllByText(/Morning Walk|Stationary Bike/);
    expect(rows[0]).toHaveTextContent('Morning Walk');
    expect(rows[1]).toHaveTextContent('Stationary Bike');
  });
});

describe('SuggestedActivityCard — WTL.F3 rest override copy', () => {
  it('shows safety rule reason in Rest instead of weekly target pressure copy', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[wtlF3WalkRestOverride]} />,
    );

    const section = restSection();
    expect(within(section).getByText('Morning Walk')).toBeInTheDocument();
    expect(within(section).getByText(/too soon after the last session/i)).toBeInTheDocument();
    expect(within(section).queryByText(/left this week/i)).not.toBeInTheDocument();
  });

  it('keeps weekly target activities out of Do when Rest overrides the target prompt', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[wtlF3WalkRestOverride]} />,
    );

    expect(within(doSection()).queryByText('Morning Walk')).not.toBeInTheDocument();
    expect(within(doSection()).queryByText(/left this week/i)).not.toBeInTheDocument();
  });
});

function suggestionCardRoot(): HTMLElement {
  const title = screen.getByText('Suggested for today');
  const card = title.closest('.rounded-lg') as HTMLElement | null;
  if (card == null) {
    throw new Error('Expected SuggestedActivityCard root');
  }
  return card;
}

describe('SuggestedActivityCard — WTL.F3 calm empty Do copy', () => {
  it('shows weekly-target-complete copy when Do is empty and all weekly targets are met', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[]} allWeeklyTargetsComplete />,
    );

    const card = suggestionCardRoot();
    expect(
      within(card).getByText(/weekly targets met for this week/i),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/nothing to suggest yet/i)).not.toBeInTheDocument();
    expect(within(card).queryByText(/you're done for today/i)).not.toBeInTheDocument();
  });
});
