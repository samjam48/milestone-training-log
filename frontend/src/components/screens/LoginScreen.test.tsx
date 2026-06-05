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

/**
 * S2.2 — Login password show / hide toggle (plans/tickets-stage-2-polish-2026-06-05.md).
 *
 * Contract (implementer):
 *   - Accessible button toggles password input `type` between `password` and `text`.
 *   - `aria-label` is "Show password" when hidden, "Hide password" when visible.
 *   - Toggle is keyboard operable; does not clear input or submit the form.
 *   - `disabled={isSubmitting}` on toggle and password input.
 */
describe('LoginScreen (S2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  function getPasswordInput(): HTMLElement {
    return screen.getByLabelText(/password/i);
  }

  it('renders a Show password toggle when the field is masked', () => {
    renderWithProviders(<LoginScreen />);

    expect(getPasswordInput()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('toggles the password field type between password and text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginScreen />);

    const passwordInput = getPasswordInput();
    const showToggle = screen.getByRole('button', { name: 'Show password' });

    await user.click(showToggle);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('activates the visibility toggle with the keyboard', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginScreen />);

    const passwordInput = getPasswordInput();
    const showToggle = screen.getByRole('button', { name: 'Show password' });
    showToggle.focus();

    await user.keyboard('{Enter}');
    expect(passwordInput).toHaveAttribute('type', 'text');

    const hideToggle = screen.getByRole('button', { name: 'Hide password' });
    hideToggle.focus();
    await user.keyboard(' ');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('does not clear the password or submit when toggling visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginScreen />);

    await user.type(getPasswordInput(), 'keep-me');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(getPasswordInput()).toHaveValue('keep-me');
    expect(apiFetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(getPasswordInput()).toHaveValue('keep-me');
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('POSTs /auth/login with the entered password after toggling visibility', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    renderWithProviders(<LoginScreen onAuthenticated={onAuthenticated} />);

    await user.type(getPasswordInput(), 'correct-horse');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
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

  it('disables the password input and visibility toggle while submitting', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: { ok: boolean }) => void = () => undefined;
    apiFetchMock.mockImplementation(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    renderWithProviders(<LoginScreen />);

    await user.type(getPasswordInput(), 'slow-start');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    const signIn = screen.getByRole('button', { name: /sign in/i });
    const hideToggle = screen.getByRole('button', { name: 'Hide password' });
    await user.click(signIn);

    await waitFor(() => {
      expect(getPasswordInput()).toBeDisabled();
      expect(hideToggle).toBeDisabled();
      expect(signIn).toBeDisabled();
    });

    resolveLogin({ ok: true });
    await waitFor(() => {
      expect(getPasswordInput()).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Hide password' })).not.toBeDisabled();
      expect(signIn).not.toBeDisabled();
    });
  });
});
