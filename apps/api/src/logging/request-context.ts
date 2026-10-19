import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger, LogFields, LogLevel } from "@trading/application";

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` so that every log entry written inside it, however deep, carries `context.requestId`. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Wraps a logger so each entry gets the `requestId` of the request being
 * served (ADR-009 point 5). Outside a request, entries pass through
 * untouched. The context wins over a `requestId` in the fields, so a line
 * can never be filed under another request.
 */
export function withRequestContext(logger: Logger): Logger {
  const write =
    (level: LogLevel) =>
    (event: string, fields?: LogFields): void => {
      const context = storage.getStore();
      logger[level](event, context ? { ...fields, requestId: context.requestId } : fields);
    };

  return {
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  };
}
