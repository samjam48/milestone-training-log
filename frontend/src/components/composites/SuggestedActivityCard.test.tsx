/**
 * S25.F6 — SuggestedActivityCard do / rest / done buckets.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { SuggestedActivityCard } from './SuggestedActivityCard';
import type { Suggestion } from '../../lib/engine';

const doSafe: Suggestion = {
  id: 'act-walk',
  label: 'Walking',
  state: 'safe',
  reason: 'Within recovery window.',
  bucket: 'do',
  scope: 'activity',
  activityClassId: 'cls-foot',
};

const doCaution: Suggestion = {
  id: 'act-jog',
  label: 'Jogging',
  state: 'caution',
  reason: 'Close to weekly cap.',
  bucket: 'do',
  scope: 'activity',
  activityClassId: 'cls-foot',
  nextSafeDate: '2026-05-30',
};

const restActivity: Suggestion = {
  id: 'act-squat',
  label: 'Heavy squat',
  state: 'danger',
  reason: 'Flare-up cooldown active.',
  bucket: 'rest',
  scope: 'activity',
  activityClassId: 'cls-foot',
};

const restClass: Suggestion = {
  id: 'cls-foot',
  label: 'Foot load',
  state: 'danger',
  reason: 'Too soon after last session.',
  bucket: 'rest',
  scope: 'class',
  activityClassId: 'cls-foot',
  description:
    'Walking, Jogging, Calf raises, Heel drops, Single-leg balance, Toe yoga, Pogo hops, Box jumps, Depth drops',
};

const doneRow: Suggestion = {
  id: 'act-stretch',
  label: 'Stretching',
  state: 'safe',
  reason: 'Logged today.',
  bucket: 'done',
  scope: 'activity',
  activityClassId: 'cls-mobility',
  description: 'Logged today.',
};

afterEach(() => {
  cleanup();
});

describe('SuggestedActivityCard — S25.F6 buckets', () => {
  it('renders Do, Rest, and Done sections from suggestion_buckets', () => {
    renderWithProviders(
      <SuggestedActivityCard
        suggestionBuckets={[doSafe, restActivity, doneRow]}
      />,
    );

    expect(screen.getByText('Do these today')).toBeInTheDocument();
    expect(screen.getByText('Rest these today')).toBeInTheDocument();
    expect(screen.getByText('Done today')).toBeInTheDocument();
    expect(screen.getByText('Walking')).toBeInTheDocument();
    expect(screen.getByText('Heavy squat')).toBeInTheDocument();
    expect(screen.getByText('Stretching')).toBeInTheDocument();
  });

  it('does not show done activities in the Do section', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[doSafe, doneRow]} />,
    );

    const doSection = screen.getByTestId('suggestion-section-do');
    expect(within(doSection).getByText('Walking')).toBeInTheDocument();
    expect(within(doSection).queryByText('Stretching')).not.toBeInTheDocument();
  });

  it('shows "You\'re done for today" when Do is empty and Rest has rows', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[restActivity, doneRow]} />,
    );

    expect(screen.getByText(/you're done for today/i)).toBeInTheDocument();
    expect(screen.queryByText('Walking')).not.toBeInTheDocument();
  });

  it('shows "You\'re done for today" when Do and Rest are empty but Done has rows', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[doneRow]} />,
    );

    expect(screen.getByText(/you're done for today/i)).toBeInTheDocument();
  });

  it('truncates class-scope rest description longer than 80 characters', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[restClass]} />,
    );

    const description = screen.getByTestId('suggestion-rest-description');
    expect(description.textContent).toMatch(/…$/);
    expect(description.textContent!.length).toBeLessThanOrEqual(80);
  });

  it('shows sensible empty state when all buckets are empty', () => {
    renderWithProviders(<SuggestedActivityCard suggestionBuckets={[]} />);

    expect(screen.getByText(/nothing to suggest yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/you're done for today/i)).not.toBeInTheDocument();
  });

  it('fires onPick for safe Do rows with a Log CTA', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    renderWithProviders(
      <SuggestedActivityCard
        suggestionBuckets={[doSafe, doCaution]}
        onPick={onPick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Log walking' }));
    expect(onPick).toHaveBeenCalledWith(doSafe);
  });

  it('does not render a Log CTA for Rest or Done rows', () => {
    renderWithProviders(
      <SuggestedActivityCard suggestionBuckets={[restActivity, doneRow]} />,
    );

    expect(screen.queryByRole('button', { name: /log/i })).not.toBeInTheDocument();
  });
});
