/**
 * F11.2 — Login screen (plans/tickets-phase-11-production-2026-06-04.md).
 *
 * Contract (implementer):
 *   - `LoginScreen` in this directory; export from screens/index when wired.
 *   - Password field + submit → `apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ password }) })`.
 *   - Surface `ApiError.message` on failure (401 invalid password).
 *   - Disable submit while the login request is in flight (cold-start double-submit guard).
 *   - Optional `onAuthenticated` callback after successful login (App refetches engine).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoginScreen } from './LoginScreen';

const { apiFetchMock, ApiErrorMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  ApiErrorMock: class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

vi.mock('../../lib/api/client', () => ({
  apiFetch: apiFetchMock,
  ApiError: ApiErrorMock,
}));

describe('LoginScreen (F11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders password field and sign-in control', () => {
    renderWithProviders(<LoginScreen />);

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('POSTs /auth/login with the entered password on submit', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    renderWithProviders(<LoginScreen onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/password/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password: 'correct-horse' }),
        }),
      );
    });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('shows the API error message when login returns 401', async () => {
    const user = userEvent.setup();
    apiFetchMock.mockRejectedValue(new ApiErrorMock(401, 'Invalid password'));

    renderWithProviders(<LoginScreen />);

    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Invalid password');
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('disables sign-in while the login request is in flight', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: { ok: boolean }) => void = () => undefined;
    apiFetchMock.mockImplementation(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    renderWithProviders(<LoginScreen />);

    await user.type(screen.getByLabelText(/password/i), 'slow-start');
    const signIn = screen.getByRole('button', { name: /sign in/i });
    await user.click(signIn);

    await waitFor(() => {
      expect(signIn).toBeDisabled();
    });

    resolveLogin({ ok: true });
    await waitFor(() => {
      expect(signIn).not.toBeDisabled();
    });
  });
});
