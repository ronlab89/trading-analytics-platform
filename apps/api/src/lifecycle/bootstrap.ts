import { createServer } from "node:http";
import type { RequestListener, Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Logger } from "@trading/application";
import { LOG_EVENTS } from "../logging/events.js";
import type { Shutdown, ShutdownStep } from "./shutdown.js";

/** How long in-flight requests get to finish after the signal (ADR-006 point 12). */
export const DRAIN_TIMEOUT_MS = 10_000;

/** The part of `process` the bootstrap listens to; tests pass an `EventEmitter`. */
export interface SignalSource {
  on(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
}

export interface StartServerOptions {
  app: RequestListener;
  port: number;
  logger: Logger;
  shutdown: Shutdown;
  /** Closes the database client. */
  disconnect: () => Promise<void>;
  signals: SignalSource;
  drainTimeoutMs?: number;
}

/** The drain ran out of time and the remaining connections were closed. */
export class DrainTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`in-flight requests did not finish within ${timeoutMs.toString()} ms`);
    this.name = "DrainTimeoutError";
  }
}

/** How often idle keep-alive connections are swept while the server drains. */
const IDLE_SWEEP_INTERVAL_MS = 50;

/**
 * Stops accepting connections and waits for the in-flight requests. When
 * `drainTimeoutMs` passes, the connections still open are closed and the step
 * fails, which makes the process exit with code 1.
 *
 * A keep-alive connection becomes idle only after its response ends, which
 * can be after `close` was called, and an idle one holds `close` open. So the
 * idle connections are swept until the server is closed.
 */
export function createHttpServerStep(server: Server, drainTimeoutMs: number): ShutdownStep {
  return {
    name: "http",
    run: () =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          clearInterval(sweep);
          server.closeAllConnections();
          reject(new DrainTimeoutError(drainTimeoutMs));
        }, drainTimeoutMs);
        const sweep = setInterval(() => {
          server.closeIdleConnections();
        }, IDLE_SWEEP_INTERVAL_MS);

        server.close((error) => {
          clearTimeout(timer);
          clearInterval(sweep);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeIdleConnections();
      }),
  };
}

/**
 * Starts listening and wires the shutdown sequence to `SIGTERM` and `SIGINT`
 * (ADR-006 point 12). The HTTP step is registered before the database step, so
 * the server drains first and Prisma closes after. B4 (jobs) and B5 (realtime)
 * register their steps on `shutdown` before calling this, so they stop first.
 */
export function startServer(options: StartServerOptions): Server {
  const { app, port, logger, shutdown, disconnect, signals } = options;
  const drainTimeoutMs = options.drainTimeoutMs ?? DRAIN_TIMEOUT_MS;

  logger.info(LOG_EVENTS.appStartupStarted, { port });

  const server = createServer(app);
  server.listen(port, () => {
    logger.info(LOG_EVENTS.appStartupCompleted, { port: (server.address() as AddressInfo).port });
  });

  shutdown.register(createHttpServerStep(server, drainTimeoutMs));
  shutdown.register({ name: "database", run: disconnect });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    signals.on(signal, () => {
      void shutdown.trigger(signal);
    });
  }

  return server;
}
