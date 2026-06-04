/**
 * F10.4 — Delayed-tax attribution on MorningCheckInScreen flare success state
 * (plans/tickets-phase-10-polish-2026-06-04.md).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import type { DelayedTaxResponse } from '../../hooks/useMilestoneEngine';
import type { ActivityClass } from '../../types';
import { MorningCheckInScreen } from './MorningCheckInScreen';

const FOOT_PERFORMANCE_CLASS: ActivityClass = {
  id: 'cls-foot',
  userId: 'user-1',
  name: 'Foot load',
  type: 'performance',
  defaultRecoveryWindowDays: 3,
  createdAt: '2026-04-07T06:00:00Z',
};

const SYMPTOM_LINKED_DELAYED_TAX: DelayedTaxResponse = {
  asOf: '2026-05-28',
  riskWindowDays: 7,
  baselineDays: 14,
  painThreshold: 3,
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
  ],
};

function setupEngine(delayedTax: DelayedTaxResponse | undefined): void {
  mockEngine.activityClasses = [FOOT_PERFORMANCE_CLASS];
  mockEngine.delayedTax = delayedTax;
}

function getAttributionSection(): HTMLElement {
  const heading = screen.getByText('What may have contributed');
  const section = heading.parentElement;
  expect(section).not.toBeNull();
  return section!;
}

async function submitCheckIn(options: { flare: boolean }): Promise<void> {
  const user = userEvent.setup();
  renderWithProviders(
    <MorningCheckInScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
  );

  if (options.flare) {
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
  }

  await user.click(screen.getByRole('button', { name: /save check-in/i }));
  expect(screen.getByText('Check-in logged.')).toBeInTheDocument();
}

describe('MorningCheckInScreen — F10.4 delayed-tax attribution', () => {
  beforeEach(() => {
    resetMockEngine();
    vi.spyOn(mockEngine, 'submitCheckIn');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows attribution subsection after flare check-in submit', async () => {
    setupEngine(SYMPTOM_LINKED_DELAYED_TAX);
    await submitCheckIn({ flare: true });

    const section = getAttributionSection();
    expect(within(section).getByText(/Pain or flare recorded on May 28/i)).toBeInTheDocument();
    expect(
      within(section).getByText(/Return session after 14 days off, symptoms within 3 days/i),
    ).toBeInTheDocument();
    expect(mockEngine.submitCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ hasFlareUp: true }),
    );
  });

  it('does not show attribution when check-in has no flare', async () => {
    setupEngine(SYMPTOM_LINKED_DELAYED_TAX);
    await submitCheckIn({ flare: false });

    expect(screen.queryByText('What may have contributed')).not.toBeInTheDocument();
    expect(mockEngine.submitCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ hasFlareUp: false }),
    );
  });
});
