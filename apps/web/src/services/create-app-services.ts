import { createAuthRetryClient } from "@/api/auth-retry-client";
import type { TradingClient } from "@/api/trading-client";
import { createSessionService, type SessionService } from "./session/session-service";

export interface AppServices {
  /** What the features use: renews an expired session and retries once. */
  client: TradingClient;
  session: SessionService;
}

/**
 * The session talks to the base client, never to the wrapped one: its own refresh
 * must not trigger another refresh. Only the features get the retrying client.
 */
export function createAppServices(baseClient: TradingClient): AppServices {
  const session = createSessionService(baseClient);
  const client = createAuthRetryClient(baseClient, session.refresh);
  return { client, session };
}
