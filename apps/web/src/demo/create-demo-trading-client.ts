import { presentLogin, presentPortfolio } from "@trading/contracts";
import type { ApiOperation } from "@trading/contracts";
import { ApiError } from "@/api/trading-client";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { logger } from "@/lib/logging/logger";
import type { DemoComposition } from "./demo-composition";
import { toApiError } from "./to-api-error";

/** Marker the bundle check looks for: the demo bundle must have it, the real one must not. */
export const DEMO_ADAPTER_MARKER = "adapter:demo";

const ACCESS_TOKEN = "demo-access-token";
const SESSION_MINUTES = 15;

type Handler = (input: CallInput) => Promise<unknown>;

export interface DemoTradingClientOptions {
  readonly composition: DemoComposition;
  readonly now?: () => Date;
}

/**
 * The in-process `TradingClient` of the demo: it runs each operation on the application services and
 * answers what the API would, error codes and response shape included (ADR-002 point 5, ADR-012).
 * Every answer is checked against the contract of its operation, so a handler that drifts from the
 * API fails here instead of on a screen.
 */
export function createDemoTradingClient(options: DemoTradingClientOptions): TradingClient {
  const { composition, now = () => new Date() } = options;
  let signedIn = false;

  logger.info(DEMO_ADAPTER_MARKER);

  function session() {
    return {
      user: composition.user,
      accessToken: ACCESS_TOKEN,
      expiresAt: new Date(now().getTime() + SESSION_MINUTES * 60_000),
    };
  }

  const handlers: Readonly<Record<string, Handler>> = {
    login: () => {
      signedIn = true;
      return Promise.resolve({ data: presentLogin(session()) });
    },
    refreshSession: () => {
      if (!signedIn) throw new ApiError("UNAUTHORIZED", "There is no session.", 401);
      return Promise.resolve({ data: presentLogin(session()) });
    },
    logout: () => {
      signedIn = false;
      return Promise.resolve(undefined);
    },
    getCurrentUser: () => Promise.resolve({ data: { user: composition.user } }),
    listPortfolios: async () => {
      const portfolios = await composition.portfolioService.listPortfolios(composition.actor);
      return { data: portfolios.map(presentPortfolio) };
    },
  };

  return {
    async call(operation: ApiOperation, input: CallInput = {}) {
      try {
        const handler = handlers[operation.operationId];
        if (!handler) {
          throw new ApiError("NOT_FOUND", "The requested resource could not be found.", 404);
        }
        if (operation.authenticated && !signedIn) {
          throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
        }
        const result = await handler(input);
        const schema = operation.success.schema;
        if (!schema) return undefined;
        const parsed = schema.safeParse(result);
        if (!parsed.success) {
          throw new ApiError("INVALID_RESPONSE", "The response does not match its contract", 500);
        }
        return parsed.data;
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}
