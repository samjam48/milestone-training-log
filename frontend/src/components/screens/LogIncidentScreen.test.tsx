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
import type { DailyCheckIn, FlareUpIncident } from '../../types';
import { LogIncidentScreen } from './LogIncidentScreen';

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

function renderLogIncident(
  incidents: FlareUpIncident[] = [],
  checkIns: typeof mockEngine.checkIns = [],
): void {
  resetMockEngine();
  mockEngine.incidents = incidents;
  mockEngine.checkIns = checkIns;
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

function makeCheckIn(
  overrides: Partial<DailyCheckIn> & Pick<DailyCheckIn, 'checkInDate'>,
): DailyCheckIn {
  return {
    id: overrides.id ?? 'ci-test',
    userId: overrides.userId ?? 'user-1',
    checkInDate: overrides.checkInDate,
    painLevel: overrides.painLevel ?? 5,
    readinessLevel: overrides.readinessLevel ?? 5,
    stiffnessLevel: overrides.stiffnessLevel ?? 5,
    hasFlareUp: overrides.hasFlareUp ?? false,
    flareUp: overrides.flareUp,
    createdAt: overrides.createdAt ?? '2026-05-01T12:00:00Z',
  };
}

describe('LogIncidentScreen — S25.F9 check-in body part chips', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a suggestion chip from check-in flare history', () => {
    renderLogIncident(
      [],
      [
        makeCheckIn({
          id: 'ci-heel',
          checkInDate: '2026-05-15',
          hasFlareUp: true,
          flareUp: {
            bodyPart: 'Left heel',
            severity: 7,
            likelyCauseActivityClassIds: [],
          },
        }),
      ],
    );

    const card = getBodyPartCard();
    expect(within(card).getByRole('button', { name: 'Left heel' })).toBeInTheDocument();
  });

  it('dedupes chips across incidents and check-ins', () => {
    renderLogIncident(
      [makeIncident({ id: 'inc-a', bodyPart: 'Right toe', incidentDate: '2026-05-20' })],
      [
        makeCheckIn({
          id: 'ci-b',
          checkInDate: '2026-05-10',
          hasFlareUp: true,
          flareUp: {
            bodyPart: 'right toe',
            severity: 6,
            likelyCauseActivityClassIds: [],
          },
        }),
      ],
    );

    const card = getBodyPartCard();
    expect(within(card).getAllByRole('button', { name: /right toe/i })).toHaveLength(1);
  });
});
