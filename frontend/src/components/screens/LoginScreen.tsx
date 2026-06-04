import * as React from 'react';
import { apiFetch, ApiError } from '../../lib/api/client';

export interface LoginScreenProps {
  onAuthenticated?: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps): React.ReactElement {
  const [password, setPassword] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await apiFetch<{ ok: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      onAuthenticated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Sign in failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      data-testid="login-screen"
      className="flex min-h-[50vh] flex-1 flex-col justify-center px-4 py-10"
    >
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-title font-bold text-ink mb-2">Sign in</h1>
        <p className="text-body text-ink-muted mb-6">
          Enter your password to open your training log.
        </p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-password" className="block text-body font-medium text-ink mb-2">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-body text-ink"
              disabled={isSubmitting}
            />
          </div>

          {errorMessage != null && (
            <p data-testid="login-error" className="text-body text-danger-fg" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-ink px-4 py-2.5 text-body font-medium text-ink-inverse disabled:opacity-60"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
