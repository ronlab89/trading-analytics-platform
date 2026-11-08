import type { Logger, LogLevel } from "@trading/application";
import { createConsoleLogger } from "@/lib/logging/console-logger";

/**
 * The level follows the Vite mode, so no variable is added (ADR-009 point 7):
 * `debug` in development, `silent` in tests and `info` otherwise.
 */
export function logLevelForMode(mode: string): LogLevel | "silent" {
  if (mode === "development") {
    return "debug";
  }
  if (mode === "test") {
    return "silent";
  }
  return "info";
}

/** The logger of the web app; code that logs receives it as a `Logger`. */
export const logger: Logger = createConsoleLogger({ level: logLevelForMode(import.meta.env.MODE) });
