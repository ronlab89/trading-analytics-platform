import { QueryClient } from "@tanstack/react-query";

/**
 * Query retries stay off: the HTTP adapter of the TradingClient port owns the
 * retry policy (ADR-011 point 15), so retrying here would multiply attempts.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
