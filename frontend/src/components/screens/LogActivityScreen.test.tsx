/**
 * C6.2 — Log form decimal volume acceptance tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { createLogActivityEngine } from '../../test/fixtures/c62Fixtures';
import { LogActivityScreen } from './LogActivityScreen';

function getVolumeInput(): HTMLInputElement {
  const volumeLabel = screen.getByText('Volume');
  const volumeField = volumeLabel.parentElement;
  expect(volumeField).not.toBeNull();
  return within(volumeField!).getByRole('spinbutton');
}

describe('LogActivityScreen volume decimals (C6.2)', () => {
  afterEach(() => {
    cleanup();
  });

  it('sets step="any" on the volume NumberField so decimal km values pass native validation', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine();

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    expect(getVolumeInput()).toHaveAttribute('step', 'any');
  });

  it('passes native validation for decimal volume values such as 1.5 km', async () => {
    const user = userEvent.setup();
    const engine = createLogActivityEngine();

    renderWithProviders(
      <LogActivityScreen engine={engine} onBack={vi.fn()} onComplete={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Morning Walk' }));

    const volumeInput = getVolumeInput();
    await user.clear(volumeInput);
    await user.type(volumeInput, '1.5');

    expect(volumeInput).toHaveValue(1.5);
    expect(volumeInput.validity.stepMismatch).toBe(false);
    expect(volumeInput.checkValidity()).toBe(true);
  });
});
