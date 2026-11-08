import { ApiError, type TradingClient } from "./trading-client";

/** Resolves `true` when the session was renewed, `false` when the API refused it. */
export type RefreshSession = () => Promise<boolean>;

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Decorates a client so an authenticated call that meets an expired access
 * token renews the session and runs once more. Only one retry: a second 401
 * means the session is gone, not stale. The refresh is injected so the
 * transport layer stays free of the session service and store.
 */
export function createAuthRetryClient(
  client: TradingClient,
  refresh: RefreshSession,
): TradingClient {
  return {
    async call(operation, input) {
      try {
        return await client.call(operation, input);
      } catch (error) {
        if (!operation.authenticated || !isUnauthorized(error)) {
          throw error;
        }
        if (!(await refresh())) {
          throw error;
        }
        return client.call(operation, input);
      }
    },
  };
}
