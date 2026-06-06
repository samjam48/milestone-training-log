/**
 * F10.4 — Delayed-tax attribution on LogIncidentScreen post-submit success
 * (plans/tickets-phase-10-polish-2026-06-04.md).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import {
  PHONE_VIEWPORT_HEIGHT,
  PHONE_VIEWPORT_WIDTH,
  SCREEN_BACK_HEADER_TEST_ID,
  expectBackControlVisibleWithoutScroll,
  expectScreenBackHeaderHasSafeTop,
  withSafeTopAncestor,
} from '../../test/screenBackLayout';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass, FlareUpIncident } from '../../types';
import { LogIncidentScreen } from './LogIncidentScreen';

const FOOT_PERFORMANCE_CLASS: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-04-07T06:00:00Z',
};

const DELAYED_TAX_BASE: Omit<DelayedTaxResponse, 'hits'> = {
  asOf: '2026-05-28',
  riskWindowDays: 7,
  baselineDays: 14,
  painThreshold: 3,
};

const PROACTIVE_ONLY_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [
    {
      hitType: 'elevated_load',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-22',
      message: 'Foot load on May 22 was above your 14-day baseline',
    },
    {
      hitType: 'rest_debt',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-24',
      message: 'Back-to-back foot sessions without enough rest',
    },
  ],
};

const SYMPTOM_LINKED_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [
    {
      hitType: 'symptom_marker',
      activityClassId: 'cls-foot',
      symptomDate: '2026-05-28',
      message: 'Pain or flare recorded on May 28',
    },
    {
      hitType: 'acute_attribution',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-20',
      symptomDate: '2026-05-28',
      primary: true,
      message: 'Return session after 14 days off, symptoms within 3 days',
    },
    {
      hitType: 'symptom_contributor',
      activityClassId: 'cls-foot',
      contributingDate: '2026-05-21',
      symptomDate: '2026-05-28',
      contributorHitType: 'elevated_load',
      message: 'Earlier elevated load in the week before symptoms',
    },
  ],
};

const EMPTY_DELAYED_TAX: DelayedTaxResponse = {
  ...DELAYED_TAX_BASE,
  hits: [],
};

function setupEngine(
  delayedTax: DelayedTaxResponse | undefined,
  options: { delayedTaxError?: boolean } = {},
): void {
  mockEngine.activityClasses = [FOOT_PERFORMANCE_CLASS];
  mockEngine.delayedTax = delayedTax;
  mockEngine.delayedTaxError = options.delayedTaxError ?? false;
}

function getAttributionSection(): HTMLElement {
  const heading = screen.getByText('What may have contributed');
  const section = heading.parentElement;
  expect(section).not.toBeNull();
  return section!;
}

async function submitIncident(bodyPart = 'Left heel'): Promise<void> {
  const user = userEvent.setup();
  renderWithProviders(
    <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
  );
  await user.type(screen.getByPlaceholderText('e.g. Right toe'), bodyPart);
  await user.click(screen.getByRole('button', { name: /record incident/i }));
  expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
}

describe('LogIncidentScreen — S2.4 back affordance', () => {
  beforeEach(() => {
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders shared back header with top safe-area padding from ancestor', () => {
    renderWithProviders(
      withSafeTopAncestor(
        <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
      ),
    );
    expectScreenBackHeaderHasSafeTop(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID));
  });

  it('shows Back control without scrolling on a 390×844 viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: PHONE_VIEWPORT_WIDTH,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: PHONE_VIEWPORT_HEIGHT,
    });

    const { container } = renderWithProviders(
      <div
        data-testid="phone-frame"
        style={{
          width: PHONE_VIEWPORT_WIDTH,
          height: PHONE_VIEWPORT_HEIGHT,
          overflow: 'hidden',
        }}
      >
        {withSafeTopAncestor(
          <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
        )}
      </div>,
    );

    const scrollRoot = container.querySelector('[data-testid="phone-frame"]');
    expect(scrollRoot).not.toBeNull();
    expect(scrollRoot).toHaveProperty('scrollTop', 0);

    const backControl = within(screen.getByTestId(SCREEN_BACK_HEADER_TEST_ID)).getByRole(
      'button',
      { name: /go back/i },
    );
    expectBackControlVisibleWithoutScroll(backControl, PHONE_VIEWPORT_HEIGHT);
  });
});

describe('LogIncidentScreen — F10.4 delayed-tax attribution', () => {
  beforeEach(() => {
    resetMockEngine();
    vi.spyOn(mockEngine, 'submitIncident');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows symptom-linked attribution hits after successful incident submit', async () => {
    setupEngine(SYMPTOM_LINKED_DELAYED_TAX);
    await submitIncident();

    const section = getAttributionSection();
    const rows = within(section).getAllByTestId('delayed-tax-hit-row');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(within(section).getByText(/Pain or flare recorded/i)).toBeInTheDocument();
    expect(within(section).getAllByText(/28th May/i).length).toBeGreaterThanOrEqual(1);
    expect(
      within(section).getByText(/Return session after 14 days off, symptoms within 3 days/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Earlier load on 21st May may have contributed/i),
    ).toBeInTheDocument();
    expect(mockEngine.submitIncident).toHaveBeenCalledOnce();
  });

  it('shows proactive load context when no symptom-linked hits exist', async () => {
    setupEngine(PROACTIVE_ONLY_DELAYED_TAX);
    await submitIncident();

    const section = getAttributionSection();
    expect(within(section).getAllByTestId('delayed-tax-hit-row')).toHaveLength(2);
    expect(within(section).getByText(/22nd May/i)).toBeInTheDocument();
    expect(within(section).getByText(/Load above your recent baseline/i)).toBeInTheDocument();
    expect(within(section).getByText(/24th May/i)).toBeInTheDocument();
    expect(within(section).getByText(/Sessions closer together/i)).toBeInTheDocument();
  });

  it('shows empty-week copy when delayed tax has no hits', async () => {
    setupEngine(EMPTY_DELAYED_TAX);
    await submitIncident();

    const section = getAttributionSection();
    expect(
      within(section).getByText(/No stacked load patterns detected this week/i),
    ).toBeInTheDocument();
  });

  it('shows brief loading copy while delayedTax is still undefined on success', async () => {
    setupEngine(undefined);
    await submitIncident();

    const section = getAttributionSection();
    expect(within(section).getByText(/loading attribution/i)).toBeInTheDocument();
  });

  it('shows error copy when delayed-tax fetch failed on success', async () => {
    setupEngine(undefined, { delayedTaxError: true });
    await submitIncident();

    const section = getAttributionSection();
    expect(within(section).getByText(/could not load attribution/i)).toBeInTheDocument();
    expect(within(section).queryByText(/loading attribution/i)).not.toBeInTheDocument();
  });

  it('keeps success screen open until Done is pressed', async () => {
    setupEngine(SYMPTOM_LINKED_DELAYED_TAX);
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={onComplete} />,
    );
    await user.type(screen.getByPlaceholderText('e.g. Right toe'), 'Left heel');
    await user.click(screen.getByRole('button', { name: /record incident/i }));
    expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^done$/i }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

const LEGACY_HARDCODED_BODY_PARTS = [
  'Left heel',
  'Right heel',
  'Left ankle',
  'Right ankle',
  'Left knee',
  'Right knee',
  'Lower back',
  'Other',
] as const;

function makeIncident(
  overrides: Partial<FlareUpIncident> & Pick<FlareUpIncident, 'bodyPart'>,
): FlareUpIncident {
  return {
    id: overrides.id ?? 'inc-test',
    userId: overrides.userId ?? 'user-1',
    incidentDate: overrides.incidentDate ?? '2026-05-01',
    severity: overrides.severity ?? 5,
    createdAt: overrides.createdAt ?? '2026-05-01T12:00:00Z',
    ...overrides,
  };
}

function getBodyPartCard(): HTMLElement {
  const heading = screen.getByText("What's flared up?");
  const card = heading.parentElement;
  expect(card).not.toBeNull();
  return card!;
}

function renderLogIncident(incidents: FlareUpIncident[] = []): void {
  resetMockEngine();
  mockEngine.incidents = incidents;
  renderWithProviders(
    <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
  );
}

describe('LogIncidentScreen — S2.5 incident body part UX', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not render legacy hardcoded BODY_PARTS chips when incident history is empty', () => {
    renderLogIncident([]);

    const card = getBodyPartCard();
    for (const part of LEGACY_HARDCODED_BODY_PARTS) {
      expect(within(card).queryByRole('button', { name: part })).not.toBeInTheDocument();
    }
  });

  it('uses a primary text field with a Right toe-style placeholder', () => {
    renderLogIncident([]);

    const card = getBodyPartCard();
    const input = within(card).getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'e.g. Right toe');
  });

  it('shows no suggestion chips when engine.incidents is empty', () => {
    renderLogIncident([]);

    const card = getBodyPartCard();
    const buttons = within(card).queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('renders a suggestion chip from incident bodyPart history', () => {
    renderLogIncident([makeIncident({ id: 'inc-toe', bodyPart: 'Right toe' })]);

    const card = getBodyPartCard();
    expect(within(card).getByRole('button', { name: 'Right toe' })).toBeInTheDocument();
  });


  it('fills the text field when a suggestion chip is tapped', async () => {
    const user = userEvent.setup();
    renderLogIncident([makeIncident({ id: 'inc-toe', bodyPart: 'Right toe' })]);

    const card = getBodyPartCard();
    await user.click(within(card).getByRole('button', { name: 'Right toe' }));
    expect(within(card).getByRole('textbox')).toHaveValue('Right toe');
  });

  it('dedupes suggestion chips case-insensitively from incident history', () => {
    renderLogIncident([
      makeIncident({
        id: 'inc-a',
        bodyPart: 'Right toe',
        incidentDate: '2026-05-20',
        createdAt: '2026-05-20T10:00:00Z',
      }),
      makeIncident({
        id: 'inc-b',
        bodyPart: 'right toe',
        incidentDate: '2026-05-10',
        createdAt: '2026-05-10T10:00:00Z',
      }),
    ]);

    const card = getBodyPartCard();
    expect(within(card).getAllByRole('button', { name: /right toe/i })).toHaveLength(1);
  });
});
