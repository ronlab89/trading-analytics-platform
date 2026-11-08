import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";
import { LOG_EVENTS } from "../logging/events.js";
import { runWithRequestContext } from "../logging/request-context.js";

export interface RequestLoggerOptions {
  /** A request slower than this many milliseconds is logged at `warn` (ADR-009 point 8). */
  slowThresholdMs: number;
  /** Monotonic milliseconds; tests pass their own. */
  now?: () => number;
}

/**
 * Writes one `http.request.completed` entry per request through the
 * `Logger` port (ADR-009 points 2, 3 and 8): method, path without the query
 * string, status, `durationMs` and, once `authenticate` ran, `userId`.
 * Written when the response finishes; a request the client abandons
 * before that point leaves no entry.
 */
export function requestLogger({
  slowThresholdMs,
  now = () => performance.now(),
}: RequestLoggerOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = now();

    res.on("finish", () => {
      const durationMs = Math.round(now() - startedAt);
      // `req.auth` is typed as present, but only `authenticate` sets it.
      const auth = req.auth as Request["auth"] | undefined;
      const queryStart = req.originalUrl.indexOf("?");
      const path = queryStart === -1 ? req.originalUrl : req.originalUrl.slice(0, queryStart);
      const level = durationMs > slowThresholdMs ? "warn" : "info";

      // The event fires from the socket, so the context is restored by hand.
      runWithRequestContext({ requestId: req.requestId }, () => {
        req.logger[level](LOG_EVENTS.httpRequestCompleted, {
          method: req.method,
          path,
          status: res.statusCode,
          durationMs,
          ...(auth ? { userId: auth.userId } : {}),
        });
      });
    });

    next();
  };
}
