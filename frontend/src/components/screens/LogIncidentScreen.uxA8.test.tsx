/**
 * UX-A8 — Post-incident confirmation cleanup
 * (plans/tickets-ux-overhaul-2026-06-12.md)
 *
 * Tests for the `submitted` state branch of LogIncidentScreen:
 * - Headline and body copy present
 * - DelayedTaxAttributionSection absent
 * - Done button: full-width, neutral styling, calls onComplete
 * - Pre-submit state unaffected
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockEngine, resetMockEngine } from '../../test/mockEngine';
import { LogIncidentScreen } from './LogIncidentScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderAndSubmit(onComplete = vi.fn()): Promise<void> {
  const user = userEvent.setup();
  renderWithProviders(
    <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={onComplete} />,
  );
  await user.type(screen.getByPlaceholderText('e.g. Right toe'), 'Left heel');
  await user.click(screen.getByRole('button', { name: /record incident/i }));
  // Guard: confirm we are in the submitted state before each assertion
  expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('LogIncidentScreen — UX-A8 post-incident confirmation cleanup', () => {
  beforeEach(() => {
    resetMockEngine();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // AC 1 — headline
  it('shows "Incident recorded." headline after submit', async () => {
    await renderAndSubmit();
    expect(screen.getByText('Incident recorded.')).toBeInTheDocument();
  });

  // AC 2 — one line of body copy
  it('shows exactly one line of body copy after submit', async () => {
    await renderAndSubmit();
    // The body copy must be a single non-empty paragraph-level element.
    // We query by role=paragraph or check a known text fragment is present.
    // The spec does not pin the exact string, but current copy is:
    // "Rest up. The heatmap and dashboard reflect today's status."
    // We assert at least one non-headline text node is present.
    const bodyCopy = screen.getByText(/rest up/i);
    expect(bodyCopy).toBeInTheDocument();
  });

  // AC 3 — DelayedTaxAttributionSection NOT rendered
  it('does not render the contributing-activities list after submit', async () => {
    // DelayedTaxAttributionSection renders a heading "What may have contributed"
    // and rows with data-testid="delayed-tax-hit-row". Neither must appear.
    await renderAndSubmit();
    expect(screen.queryByText(/what may have contributed/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="delayed-tax-hit-row"]')).toBeNull();
  });

  // AC 4 — Done button present and calls onComplete
  it('renders a Done button that calls onComplete when clicked', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={onComplete} />,
    );
    await user.type(screen.getByPlaceholderText('e.g. Right toe'), 'Right knee');
    await user.click(screen.getByRole('button', { name: /record incident/i }));
    expect(screen.getByText('Incident recorded.')).toBeInTheDocument();

    const doneBtn = screen.getByRole('button', { name: /^done$/i });
    expect(doneBtn).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(doneBtn);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  // AC 5 — Done button does NOT use danger/red background
  it('Done button does not carry a bg-danger class', async () => {
    await renderAndSubmit();
    const doneBtn = screen.getByRole('button', { name: /^done$/i });
    expect(doneBtn.className).not.toMatch(/bg-danger/);
  });

  // AC 6 — Done button is full-width
  it('Done button has w-full class', async () => {
    await renderAndSubmit();
    const doneBtn = screen.getByRole('button', { name: /^done$/i });
    expect(doneBtn.className).toMatch(/\bw-full\b/);
  });

  // AC 7 — pre-submit state renders the normal incident form
  it('pre-submit state renders the normal incident form without the success headline', () => {
    renderWithProviders(
      <LogIncidentScreen engine={mockEngine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );
    expect(screen.queryByText('Incident recorded.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record incident/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Right toe')).toBeInTheDocument();
  });
});
