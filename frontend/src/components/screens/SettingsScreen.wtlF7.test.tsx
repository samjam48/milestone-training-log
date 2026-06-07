/**
 * WTL.F7 — Settings weekly focus UI (failing first, TDD).
 * plans/tickets-weekly-targets-load-risk-2026-06-07.md §WTL.F7
 *
 * Reuses SettingsScreen.test.tsx patterns and BlockReviewScreen navigation contract.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { P25_6_RULE_LABELS } from '../../test/ruleTaxonomy';
import {
  WTL_F7_ACTIVE_WEEKLY_FOCUS,
  WTL_F7_FOCUS_TITLE,
  WTL_F7_NO_ACTIVE_BLOCK,
  WTL_F7_PREVIOUS_WEEK_1,
  WTL_F7_PREVIOUS_WEEK_2,
  WTL_F7_RESET_FOCUS_BLOCK,
  WTL_F7_RULE_REST,
  type WeeklyFocusBlock,
} from '../../test/wtlF7WeeklyFocusFixtures';
import { SettingsScreen } from './SettingsScreen';
import { ApiError } from '../../lib/api/client';

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

type WtlF7Engine = typeof mockEngine & {
  setupWeeklyFocus?: (focusTitle: string) => Promise<void>;
  resetWeeklyFocus?: (focusTitle: string) => Promise<void>;
  patchFocusTitle?: (focusTitle: string) => Promise<void>;
};

function makeEngine(overrides: Partial<WtlF7Engine> = {}): WtlF7Engine {
  return { ...mockEngine, ...overrides };
}

function getWeeklyFocusSection(): HTMLElement {
  const heading =
    screen.queryByText(/^weekly focus$/i)
    ?? screen.queryByText(/^training block$/i);
  expect(heading).not.toBeNull();
  const section = heading?.closest('section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

function renderSettings(props: {
  engine: WtlF7Engine;
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

function renderStatefulWeeklyFocusSettings(options: {
  initialBlock?: WeeklyFocusBlock;
  previousBlocks?: WeeklyFocusBlock[];
} = {}): {
  patchFocusTitle: ReturnType<typeof vi.fn>;
  resetWeeklyFocus: ReturnType<typeof vi.fn>;
  setupWeeklyFocus: ReturnType<typeof vi.fn>;
  rerender: (block: WeeklyFocusBlock) => void;
} {
  let currentBlock = options.initialBlock ?? WTL_F7_ACTIVE_WEEKLY_FOCUS;
  const previousBlocks = options.previousBlocks ?? [];

  const patchFocusTitle = vi.fn(async (focusTitle: string) => {
    currentBlock = {
      ...currentBlock,
      focusTitle,
      name: `${focusTitle} · Week ${currentBlock.weekNumber}`,
    };
    rerender(currentBlock);
  });

  const resetWeeklyFocus = vi.fn(async (focusTitle: string) => {
    currentBlock = {
      ...WTL_F7_RESET_FOCUS_BLOCK,
      focusTitle,
      name: `${focusTitle} · Week 1`,
    };
    rerender(currentBlock);
  });

  const setupWeeklyFocus = vi.fn(async (focusTitle: string) => {
    currentBlock = {
      ...WTL_F7_RESET_FOCUS_BLOCK,
      focusTitle,
      name: `${focusTitle} · Week 1`,
    };
    rerender(currentBlock);
  });

  let renderApi = renderWithProviders(<div />);

  const rerender = (block: WeeklyFocusBlock) => {
    renderApi.rerender(
      <SettingsScreen
        engine={makeEngine({
          block,
          previousBlocks,
          rules: [WTL_F7_RULE_REST],
          activityClasses: [],
          patchFocusTitle,
          resetWeeklyFocus,
          setupWeeklyFocus,
        })}
        onEditRules={vi.fn()}
        onReview={vi.fn()}
        onViewBlock={vi.fn()}
      />,
    );
  };

  renderApi.unmount();
  renderApi = renderWithProviders(
    <SettingsScreen
      engine={makeEngine({
        block: currentBlock,
        previousBlocks,
        rules: [WTL_F7_RULE_REST],
        activityClasses: [],
        patchFocusTitle,
        resetWeeklyFocus,
        setupWeeklyFocus,
      })}
      onEditRules={vi.fn()}
      onReview={vi.fn()}
      onViewBlock={vi.fn()}
    />,
  );

  return { patchFocusTitle, resetWeeklyFocus, setupWeeklyFocus, rerender };
}

afterEach(() => {
  cleanup();
  resetMockEngine();
  vi.clearAllMocks();
});

describe('SettingsScreen — WTL.F7 weekly focus display', () => {
  it('shows focus title and week number for the active weekly focus', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    const section = getWeeklyFocusSection();
    expect(within(section).getByText(WTL_F7_FOCUS_TITLE)).toBeInTheDocument();
    expect(within(section).getByText(/week 3/i)).toBeInTheDocument();
  });

  it('does not use month-style end date as the primary weekly focus copy', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    const section = getWeeklyFocusSection();
    expect(within(section).queryByText(/ends jun/i)).not.toBeInTheDocument();
    expect(within(section).queryByText(/started jun/i)).not.toBeInTheDocument();
  });

  it('labels the section Weekly focus instead of Training Block', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    expect(screen.getByText(/^weekly focus$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^training block$/i)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — WTL.F7 remove month-style new block flow', () => {
  it('does not render + New Training Block', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        weeklyTargets: [],
        activityClasses: [],
      }),
    });

    expect(
      screen.queryByRole('button', { name: /\+ new training block/i }),
    ).not.toBeInTheDocument();
  });

  it('does not expose onNewBlock navigation for creating month-style blocks', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
      }),
    });

    expect(
      screen.queryByRole('button', { name: /new training block/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /new block/i }),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — WTL.F7 edit focus title', () => {
  it('saves an edited wider focus title via engine.patchFocusTitle', async () => {
    const user = userEvent.setup();
    const { patchFocusTitle } = renderStatefulWeeklyFocusSettings();

    await user.click(screen.getByRole('button', { name: /edit focus title/i }));
    const dialog = screen.getByRole('dialog', { name: /edit focus title/i });
    const titleInput = within(dialog).getByLabelText(/focus title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Stronger ankles');
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(patchFocusTitle).toHaveBeenCalledWith('Stronger ankles');
    });
    expect(screen.getByText('Stronger ankles')).toBeInTheDocument();
    expect(screen.getByText(/week 3/i)).toBeInTheDocument();
  });

  it('keeps the edit form open and shows an error when patchFocusTitle fails', async () => {
    const user = userEvent.setup();
    const patchFocusTitle = vi.fn().mockRejectedValue(
      new ApiError(422, 'focus_title cannot be empty'),
    );

    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        activityClasses: [],
        patchFocusTitle,
      }),
    });

    await user.click(screen.getByRole('button', { name: /edit focus title/i }));
    const dialog = screen.getByRole('dialog', { name: /edit focus title/i });
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(
        within(dialog).getByText(/focus_title cannot be empty/i),
      ).toBeInTheDocument();
    });
    expect(dialog).toBeInTheDocument();
  });
});

describe('SettingsScreen — WTL.F7 reset wider focus', () => {
  it('asks for confirmation before resetting the wider focus', async () => {
    const user = userEvent.setup();
    renderStatefulWeeklyFocusSettings();

    await user.click(screen.getByRole('button', { name: /reset focus/i }));

    expect(screen.getByRole('dialog', { name: /reset weekly focus/i })).toBeInTheDocument();
    expect(screen.getByText(/start week 1/i)).toBeInTheDocument();
  });

  it('calls engine.resetWeeklyFocus and shows Week 1 after confirmation', async () => {
    const user = userEvent.setup();
    const { resetWeeklyFocus } = renderStatefulWeeklyFocusSettings();

    await user.click(screen.getByRole('button', { name: /reset focus/i }));
    const dialog = screen.getByRole('dialog', { name: /reset weekly focus/i });
    const titleInput = within(dialog).getByLabelText(/focus title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Build running base');
    await user.click(within(dialog).getByRole('button', { name: /^reset focus$/i }));

    await waitFor(() => {
      expect(resetWeeklyFocus).toHaveBeenCalledWith('Build running base');
    });
    expect(screen.getByText('Build running base')).toBeInTheDocument();
    expect(screen.getByText(/week 1/i)).toBeInTheDocument();
  });
});

describe('SettingsScreen — WTL.F7 rules and review remain available', () => {
  it('still renders Edit rules for the active weekly focus', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [WTL_F7_RULE_REST],
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
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [WTL_F7_RULE_REST],
        activityClasses: [],
      }),
      onEditRules,
    });

    await user.click(screen.getByRole('button', { name: /edit rules/i }));
    expect(onEditRules).toHaveBeenCalledTimes(1);
  });

  it('lists previous weekly focuses with focus title and week number', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        previousBlocks: [WTL_F7_PREVIOUS_WEEK_2, WTL_F7_PREVIOUS_WEEK_1],
        rules: [],
        activityClasses: [],
      }),
    });

    expect(screen.getByText(/^previous weeks$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^previous blocks$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/return to walking · week 2/i)).toBeInTheDocument();
    expect(screen.getByText(/return to walking · week 1/i)).toBeInTheDocument();
  });

  it('navigates to block review for a previous weekly focus via onViewBlock', async () => {
    const user = userEvent.setup();
    const onViewBlock = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        previousBlocks: [WTL_F7_PREVIOUS_WEEK_2],
        rules: [],
        activityClasses: [],
      }),
      onViewBlock,
    });

    const previousWeekRow = screen.getByText(/return to walking · week 2/i).closest('div');
    expect(previousWeekRow).not.toBeNull();
    const viewButton = within(previousWeekRow as HTMLElement).getByRole('button', { name: /view/i });
    await user.click(viewButton);

    expect(onViewBlock).toHaveBeenCalledTimes(1);
    expect(onViewBlock).toHaveBeenCalledWith(WTL_F7_PREVIOUS_WEEK_2.id);
  });

  it('still exposes Review for the active weekly focus', async () => {
    const user = userEvent.setup();
    const onReview = vi.fn();

    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        activityClasses: [],
      }),
      onReview,
    });

    await user.click(screen.getByRole('button', { name: /^review$/i }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen — WTL.F7 no active focus setup', () => {
  it('shows a setup weekly focus action when no active focus exists', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_NO_ACTIVE_BLOCK,
        rules: [],
        activityClasses: [],
      }),
    });

    expect(
      screen.getByRole('button', { name: /set up weekly focus/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no active training block/i)).not.toBeInTheDocument();
  });

  it('does not show a setup action when an active weekly focus already exists', () => {
    renderSettings({
      engine: makeEngine({
        block: WTL_F7_ACTIVE_WEEKLY_FOCUS,
        rules: [],
        activityClasses: [],
      }),
    });

    expect(
      screen.queryByRole('button', { name: /set up weekly focus/i }),
    ).not.toBeInTheDocument();
  });

  it('creates week 1 via engine.setupWeeklyFocus from the setup dialog', async () => {
    const user = userEvent.setup();
    const setupWeeklyFocus = vi.fn().mockResolvedValue(undefined);

    renderSettings({
      engine: makeEngine({
        block: WTL_F7_NO_ACTIVE_BLOCK,
        rules: [],
        activityClasses: [],
        setupWeeklyFocus,
      }),
    });

    await user.click(screen.getByRole('button', { name: /set up weekly focus/i }));
    const dialog = screen.getByRole('dialog', { name: /set up weekly focus/i });
    await user.type(within(dialog).getByLabelText(/focus title/i), 'First weekly focus');
    await user.click(within(dialog).getByRole('button', { name: /create focus/i }));

    await waitFor(() => {
      expect(setupWeeklyFocus).toHaveBeenCalledWith('First weekly focus');
    });
  });
});
