import type { LogFields, Logger, LogLevel } from "@trading/application";

export const REDACTED_VALUE = "[Redacted]";

/**
 * Field names that never reach the console (ADR-009 point 4), compared in
 * lower case at any depth. It is the list of the API pino adapter, so a
 * field redacted on the server is redacted in the browser too.
 */
const REDACTED_KEYS = new Set([
  "password",
  "authorization",
  "cookie",
  "set-cookie",
  "accesstoken",
  "refreshtoken",
  "token",
  "input",
]);

const LEVEL_RANK: Record<LogLevel | "silent", number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface ConsoleLoggerOptions {
  /** Entries below this level are dropped; `silent` drops all of them. */
  level: LogLevel | "silent";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED_VALUE : redact(entry),
    ]),
  );
}

/**
 * The browser-console adapter of the `Logger` port (ADR-009 point 1). Each
 * entry is one `console` call: the message (the event name unless the caller
 * passes one) and an object with `event` and the redacted fields.
 */
export function createConsoleLogger(options: ConsoleLoggerOptions): Logger {
  const threshold = LEVEL_RANK[options.level];

  const write =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}): void => {
      if (LEVEL_RANK[level] < threshold) {
        return;
      }
      const { message, ...rest } = fields;
      console[level](typeof message === "string" ? message : event, {
        event,
        ...(redact(rest) as LogFields),
      });
    };

  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  };
}
