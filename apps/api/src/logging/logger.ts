import type { Logger } from "@trading/application";
import { env } from "../config/env.js";
import { createPinoLogger } from "./pino-logger.js";

/**
 * The API's logger, wired once here (ADR-009 point 1). `createApp` takes it
 * as an option so tests can pass a capturing logger instead. The level comes
 * from `LOG_LEVEL`, which defaults to `silent` under `NODE_ENV=test`.
 */
export const logger: Logger = createPinoLogger({
  level: env.LOG_LEVEL,
  service: "trading-api",
  environment: env.NODE_ENV,
  pretty: env.NODE_ENV === "development",
});
