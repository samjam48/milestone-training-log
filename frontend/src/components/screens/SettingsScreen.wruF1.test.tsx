/**
 * WRU.F1 — Settings weekly rules UI (failing first, TDD).
 * plans/tickets-weekly-rules-unification-2026-06-08.md §WRU.F1
 *
 * Replaces SettingsScreen.wtlF7.test.tsx.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import {
  WRU_F1_ACTIVE_WEEK,
  WRU_F1_ACTIVE_WEEK_LABEL,
  WRU_F1_PREVIOUS_WEEK_1,
  WRU_F1_PREVIOUS_WEEK_1_LABEL,
  WRU_F1_PREVIOUS_WEEK_2,
  WRU_F1_PREVIOUS_WEEK_2_LABEL,
  WRU_F1_RULE_REST,
} from '../../test/wruF1WeeklyRulesFixtures';
import { SettingsScreen } from './SettingsScreen';

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/api/client', () => ({
  apiFetch: apiFetchMock,
  apiFetchOrNullOn404: vi.fn().mockResolvedValue(null),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

type WruF1Engine = typeof mockEngine;

function makeEngine(overrides: Partial<WruF1Engine> = {}): WruF1Engine {
  return { ...mockEngine, ...overrides };
}

function getWeeklyRulesSection(): HTMLElement {
  const heading = screen.getByText(/^weekly rules$/i);
  const section = heading.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

function renderSettings(props: {
  engine: WruF1Engine;
  onEditRules?: () => void;
  onReview?: () => void;
  onViewBlock?: (blockId: string) => void;
}): void {
  renderWithProviders(
    <SettingsScreen
      engine={props.engine}
      onEditRules={props.onEditRules}
      onReview={props.onReview}
      onViewBlock={props.onViewBlock}
    />,
  );
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('SettingsScreen — WRU.F1 weekly rules section', () => {
  it('labels the section Weekly rules', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    expect(screen.getByText(/^weekly rules$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^weekly focus$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^training block$/i)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — WRU.F1 active card calendar label', () => {
  it('shows Mon–Sun calendar range as the primary active card label', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    const section = getWeeklyRulesSection();
    expect(within(section).getByText(WRU_F1_ACTIVE_WEEK_LABEL)).toBeInTheDocument();
  });

  it('does not show editable focus title, week number, or month-style Started copy', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    const section = getWeeklyRulesSection();
    expect(within(section).queryByText(WRU_F1_ACTIVE_WEEK.focusTitle)).not.toBeInTheDocument();
    expect(within(section).queryByText(/week 3/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/started jun/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/ends jun/i)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — WRU.F1 remove legacy create and focus flows', () => {
  it('does not render + New Training Block', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    expect(
      screen.queryByRole('button', { name: /\+ new training block/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /new training block/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render Edit focus title, Reset focus, or Set up weekly rules actions', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        activityClasses: [],
      }),
    });

    expect(
      screen.queryByRole('button', { name: /edit focus title/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reset focus/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /set up weekly/i }),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — WRU.F1 edit rules and review unchanged', () => {
  it('still renders Edit rules for the active weekly rules card', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [WRU_F1_RULE_REST],
        activityClasses: [],
      }),
      onEditRules: vi.fn(),
    });

    expect(screen.getByRole('button', { name: /edit rules/i })).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(P25_6_RULE_LABELS.rest_between_class, 'i')),
    ).toBeInTheDocument();
  });

  it('calls onEditRules when Edit rules is clicked', async () => {
    const user = userEvent.setup();
    const onEditRules = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [WRU_F1_RULE_REST],
        activityClasses: [],
      }),
      onEditRules,
    });

    await user.click(screen.getByRole('button', { name: /edit rules/i }));
    expect(onEditRules).toHaveBeenCalledTimes(1);
  });

  it('still exposes Review for the active weekly rules card', async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        rules: [],
        activityClasses: [],
      }),
      onReview,
    });

    await user.click(screen.getByRole('button', { name: /^review$/i }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen — WRU.F1 previous weeks', () => {
  it('hides Previous weeks when there are no completed weeks', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [],
        rules: [],
        activityClasses: [],
      }),
    });

    expect(screen.queryByText(/^previous weeks$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^previous blocks$/i)).not.toBeInTheDocument();
  });

  it('shows at most one completed week inline — the most recent', () => {
    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [WRU_F1_PREVIOUS_WEEK_2, WRU_F1_PREVIOUS_WEEK_1],
        rules: [],
        activityClasses: [],
      }),
    });

    expect(screen.getByText(WRU_F1_PREVIOUS_WEEK_2_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(WRU_F1_PREVIOUS_WEEK_1_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByText(/return to walking/i)).not.toBeInTheDocument();
  });

  it('opens a modal with the full scrollable previous-week list when Previous weeks is tapped', async () => {
    const user = userEvent.setup();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [WRU_F1_PREVIOUS_WEEK_2, WRU_F1_PREVIOUS_WEEK_1],
        rules: [],
        activityClasses: [],
      }),
    });

    await user.click(screen.getByRole('button', { name: /^previous weeks$/i }));

    const dialog = await screen.findByRole('dialog', { name: /previous weeks/i });
    expect(within(dialog).getByText(WRU_F1_PREVIOUS_WEEK_2_LABEL)).toBeInTheDocument();
    expect(within(dialog).getByText(WRU_F1_PREVIOUS_WEEK_1_LABEL)).toBeInTheDocument();
  });

  it('navigates to block review when a previous week row is tapped in the modal', async () => {
    const user = userEvent.setup();
    const onViewBlock = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [WRU_F1_PREVIOUS_WEEK_2, WRU_F1_PREVIOUS_WEEK_1],
        rules: [],
        activityClasses: [],
      }),
      onViewBlock,
    });

    await user.click(screen.getByRole('button', { name: /^previous weeks$/i }));
    const dialog = await screen.findByRole('dialog', { name: /previous weeks/i });
    const olderWeekRow = within(dialog).getByText(WRU_F1_PREVIOUS_WEEK_1_LABEL).closest('button');
    expect(olderWeekRow).not.toBeNull();
    await user.click(olderWeekRow as HTMLElement);

    await waitFor(() => {
      expect(onViewBlock).toHaveBeenCalledWith(WRU_F1_PREVIOUS_WEEK_1.id);
    });
  });

  it('navigates to block review for the inline most-recent week via onViewBlock', async () => {
    const user = userEvent.setup();
    const onViewBlock = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [WRU_F1_PREVIOUS_WEEK_2],
        rules: [],
        activityClasses: [],
      }),
      onViewBlock,
    });

    const inlineRow = screen.getByText(WRU_F1_PREVIOUS_WEEK_2_LABEL).closest('button');
    expect(inlineRow).not.toBeNull();
    await user.click(inlineRow as HTMLElement);

    expect(onViewBlock).toHaveBeenCalledWith(WRU_F1_PREVIOUS_WEEK_2.id);
  });
});

describe('SettingsScreen — WRU.F1 previous weeks modal empty state', () => {
  it('shows calm empty copy when Previous weeks modal is opened with only the inline week', async () => {
    const user = userEvent.setup();

    renderSettings({
      engine: makeEngine({
        block: WRU_F1_ACTIVE_WEEK,
        previousBlocks: [WRU_F1_PREVIOUS_WEEK_2],
        rules: [],
        activityClasses: [],
      }),
    });

    await user.click(screen.getByRole('button', { name: /^previous weeks$/i }));
    const dialog = await screen.findByRole('dialog', { name: /previous weeks/i });

    expect(within(dialog).getByText(/no earlier weeks/i)).toBeInTheDocument();
  });
});
