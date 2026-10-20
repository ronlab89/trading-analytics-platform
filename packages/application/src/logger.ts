export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured fields of one log entry. `message` is optional: an adapter
 * builds it from the event name when the caller does not pass one.
 */
export type LogFields = Readonly<Record<string, unknown>>;

/**
 * The only way application code writes a log entry.
 * Source: ADR-009 points 1 and 3.
 *
 * `event` is a stable dotted name such as `http.request.completed`. The API
 * wires a pino adapter in the composition root; the demo wires a
 * browser-console adapter; tests pass `capturingLogger`. Nothing in this
 * package imports a logging library.
 */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly event: string;
  readonly fields: LogFields;
}

/** A logger that records every entry in order, for tests that assert log content. */
export interface CapturingLogger extends Logger {
  readonly entries: readonly LogEntry[];
}

export function capturingLogger(): CapturingLogger {
  const entries: LogEntry[] = [];
  const record =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}): void => {
      entries.push({ level, event, fields });
    };
  return {
    entries,
    debug: record("debug"),
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
  };
}

/** A logger that drops every entry, for code under test that logs but is not asserted on. */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
