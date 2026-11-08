import { pino } from "pino";
import type { DestinationStream } from "pino";
import type { Logger, LogFields, LogLevel } from "@trading/application";

/**
 * Fields that never reach a log line (ADR-009 point 4): passwords, the
 * Authorization header, cookies, access and refresh tokens, the response
 * Set-Cookie header, the token of the WebSocket authentication message and
 * the stored CSV input of a job. `*.x` covers one level of nesting, which is
 * where pino-http puts `req` and `res`.
 */
export const REDACTED_PATHS = [
  "password",
  "*.password",
  "authorization",
  "*.authorization",
  "*.headers.authorization",
  "cookie",
  "*.cookie",
  "*.headers.cookie",
  '*.headers["set-cookie"]',
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "token",
  "*.token",
  "input",
  "*.input",
];

export const REDACTED_VALUE = "[Redacted]";

export interface PinoLoggerOptions {
  level: LogLevel | "silent";
  service: string;
  environment: string;
  /** `pino-pretty` output, for development only (ADR-009 point 2). */
  pretty?: boolean;
  /** Where the JSON lines go; stdout when absent. Tests pass their own stream. */
  destination?: DestinationStream;
}

/**
 * The pino adapter of the `Logger` port (ADR-009 points 1 to 3). One JSON
 * line per event with `timestamp`, `level`, `service`, `environment`,
 * `event` and `message`; the message is the event name unless the caller
 * passes one.
 */
export function createPinoLogger(options: PinoLoggerOptions): Logger {
  const settings = {
    level: options.level,
    base: { service: options.service, environment: options.environment },
    messageKey: "message",
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: { level: (label: string) => ({ level: label }) },
    redact: { paths: REDACTED_PATHS, censor: REDACTED_VALUE },
  };
  const root = options.pretty
    ? pino({ ...settings, transport: { target: "pino-pretty" } })
    : pino(settings, options.destination);

  const write =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}): void => {
      const { message, ...rest } = fields;
      root[level]({ ...rest, event }, typeof message === "string" ? message : event);
    };

  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  };
}
