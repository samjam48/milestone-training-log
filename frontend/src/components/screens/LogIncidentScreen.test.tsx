/**
 * F10.4 — Delayed-tax attribution on LogIncidentScreen post-submit success
 * (plans/tickets-phase-10-polish-2026-06-04.md).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';
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

async function submitIncident(): Promise<void> {
  const user = userEvent.setup();
  renderWithProviders(
    <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
  );
  await user.click(screen.getByRole('button', { name: 'Left heel' }));
  await user.click(screen.getByRole('button', { name: /record incident/i }));
  expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
}

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
    expect(within(section).getByText(/Pain or flare recorded on May 28/i)).toBeInTheDocument();
    expect(
      within(section).getByText(/Return session after 14 days off, symptoms within 3 days/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Earlier elevated load in the week before symptoms/i),
    ).toBeInTheDocument();
    expect(mockEngine.submitIncident).toHaveBeenCalledOnce();
  });

  it('shows proactive load context when no symptom-linked hits exist', async () => {
    setupEngine(PROACTIVE_ONLY_DELAYED_TAX);
    await submitIncident();

    const section = getAttributionSection();
    expect(
      within(section).getByText(/Foot load on May 22 was above your 14-day baseline/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Back-to-back foot sessions without enough rest/i),
    ).toBeInTheDocument();
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
});
