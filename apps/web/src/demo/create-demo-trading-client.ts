import type { Clock } from "@trading/application";
import type { ApiOperation } from "@trading/contracts";
import { ApiError } from "@/api/trading-client";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { logger } from "@/lib/logging/logger";
import type { DemoComposition } from "./demo-composition";
import { createAlertHandlers } from "./handlers/alert-handlers";
import { createDecisionHandlers } from "./handlers/decision-handlers";
import { createScenarioHandlers } from "./handlers/scenario-handlers";
import { createAnalyticsHandlers } from "./handlers/analytics-handlers";
import { createAuthHandlers } from "./handlers/auth-handlers";
import type { DemoSession, HandlerContext } from "./handlers/handler";
import { createJobHandlers } from "./handlers/job-handlers";
import { createMarketHandlers } from "./handlers/market-handlers";
import { createPortfolioHandlers } from "./handlers/portfolio-handlers";
import { createTransactionHandlers } from "./handlers/transaction-handlers";
import { createWatchlistHandlers } from "./handlers/watchlist-handlers";
import { runIdempotent } from "./idempotency";
import { NO_LATENCY } from "./latency";
import type { Latency } from "./latency";
import { toApiError } from "./to-api-error";

/** Marker the bundle check looks for: the demo bundle has it, the real one must not. */
export const DEMO_ADAPTER_MARKER = "adapter:demo";

export interface DemoTradingClientOptions {
  readonly composition: DemoComposition;
  readonly clock?: Clock;
  /** Simulated wait per call; none by default, so tests and the smoke run fast. */
  readonly latency?: Latency;
}

type RequestPart = "params" | "query" | "body";

const INVALID_MESSAGES: Record<RequestPart, string> = {
  params: "The request contains invalid route parameters.",
  query: "The request contains invalid query parameters.",
  body: "The request contains invalid fields.",
};

/** Query values reach the API as text, so the schemas of the contract coerce them. */
function queryAsText(query: CallInput["query"]): Record<string, string> {
  const entries = Object.entries(query ?? {}).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
  );
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
}

/** Parses one part of the request like the API validation middleware, with the same error. */
function check(operation: ApiOperation, part: RequestPart, value: unknown): unknown {
  const schema = operation[part];
  if (!schema) return value;
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ApiError(
    "VALIDATION_ERROR",
    INVALID_MESSAGES[part],
    400,
    undefined,
    parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  );
}

/**
 * The in-process `TradingClient` of the demo: it runs each operation on the application services and
 * answers what the API would, error codes and response shape included (ADR-002 point 5, ADR-012).
 * The request and the answer are checked against the contract of the operation, so a handler that
 * drifts from the API fails here instead of on a screen.
 */
export function createDemoTradingClient(options: DemoTradingClientOptions): TradingClient {
  const { composition, clock = { now: () => new Date() }, latency = NO_LATENCY } = options;
  const session: DemoSession = { signedIn: false };
  const context: HandlerContext = { composition, session, clock, actor: composition.actor };
  const handlers = {
    ...createAuthHandlers(context),
    ...createPortfolioHandlers(context),
    ...createMarketHandlers(context),
    ...createWatchlistHandlers(context),
    ...createTransactionHandlers(context),
    ...createJobHandlers(context),
    ...createAnalyticsHandlers(context),
    ...createAlertHandlers(context),
    ...createDecisionHandlers(context),
    ...createScenarioHandlers(context),
  };

  logger.info(DEMO_ADAPTER_MARKER);

  return {
    async call(operation: ApiOperation, input: CallInput = {}) {
      try {
        await latency.wait(operation.method);
        const handler = handlers[operation.operationId];
        if (!handler) {
          throw new ApiError("NOT_FOUND", "The requested resource could not be found.", 404);
        }
        if (operation.authenticated && !session.signedIn) {
          throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
        }
        const params = check(operation, "params", input.params ?? {});
        const body = check(operation, "body", input.body);
        const run = () =>
          handler({ params, query: check(operation, "query", queryAsText(input.query)), body });
        const result =
          input.idempotencyKey !== undefined && operation.headers
            ? await runIdempotent(
                composition.idempotencyService,
                {
                  userId: composition.actor.userId,
                  key: input.idempotencyKey,
                  operationId: operation.operationId,
                  successStatus: operation.success.status,
                  params,
                  body,
                },
                run,
              )
            : await run();
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
