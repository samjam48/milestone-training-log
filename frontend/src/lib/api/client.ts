/**
 * Base HTTP client for Milestone backend API (/api prefix).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export function parseApiError(status: number, bodyText: string): ApiError {
  if (!bodyText.trim()) {
    return new ApiError(status, `Request failed with status ${status}`);
  }

  try {
    const parsed = JSON.parse(bodyText) as { detail?: unknown };
    const { detail } = parsed;

    if (typeof detail === 'string') {
      return new ApiError(status, detail, detail);
    }

    if (Array.isArray(detail)) {
      const message =
        detail
          .map((item) => {
            if (item && typeof item === 'object' && 'loc' in item && 'msg' in item) {
              const entry = item as { loc: unknown; msg: unknown };
              const loc = Array.isArray(entry.loc) ? entry.loc.join('.') : String(entry.loc);
              return `${loc}: ${String(entry.msg)}`;
            }
            return JSON.stringify(item);
          })
          .join('; ') || `Request failed with status ${status}`;

      return new ApiError(status, message, detail);
    }

    return new ApiError(status, bodyText, detail);
  } catch {
    return new ApiError(status, bodyText);
  }
}

function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/api${normalized}`;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiPath(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw parseApiError(response.status, bodyText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Returns null on 404; rethrows other errors (for optional singleton reads). */
export async function apiFetchOrNullOn404<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
