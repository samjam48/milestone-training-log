import * as React from 'react';
import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface RenderHookWithProvidersOptions<Props> extends Omit<RenderHookOptions<Props>, 'wrapper'> {
  queryClient?: QueryClient;
}

export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options: RenderHookWithProvidersOptions<Props> = {},
): RenderHookResult<Result, Props> & { queryClient: QueryClient } {
  const queryClient = options.queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return {
    ...renderHook(hook, { ...options, wrapper: Wrapper }),
    queryClient,
  };
}
