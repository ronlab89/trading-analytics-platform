import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createQueryClient } from "@/lib/query-client";
import { SessionServiceProvider } from "@/services/session/session-provider";
import type { SessionService } from "@/services/session/session-service";

/** A `SessionService` whose calls are all spies; override what a test cares about. */
export function fakeSessionService(overrides: Partial<SessionService> = {}): SessionService {
  return {
    login: () => Promise.resolve(),
    restore: () => Promise.resolve(),
    refresh: () => Promise.resolve(true),
    logout: () => Promise.resolve(),
    ...overrides,
  };
}

/** The providers a hook that talks to the session needs, with a fresh query cache. */
export function sessionWrapper(
  service: SessionService,
  queryClient: QueryClient = createQueryClient(),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionServiceProvider service={service}>{children}</SessionServiceProvider>
      </QueryClientProvider>
    );
  };
}
