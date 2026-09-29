import type { Request, Response } from "express";
import { checkDatabaseConnection } from "../services/health.service.js";

/**
 * Liveness — answers "is the process running?". Deliberately lightweight:
 * no dependency checks. See 13-observability-spec.md §23.
 */
export function livenessHandler(_req: Request, res: Response): void {
  res.json({
    status: "ok",
    service: "trading-api",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Readiness — answers "is the application ready to serve requests that
 * require its dependencies?". Delegates the actual check to
 * `checkDatabaseConnection` (health.service.ts) (13-observability-spec.md
 * §23, 07-api-spec.md §30).
 *
 * Never exposes connection strings, credentials, or raw driver error
 * details in the response body (13-observability-spec.md §24) — only a
 * generic "unhealthy" status. Full detail goes to server-side logs only.
 */
export async function readinessHandler(req: Request, res: Response): Promise<void> {
  try {
    await checkDatabaseConnection();

    res.json({
      status: "ok",
      service: "trading-api",
      timestamp: new Date().toISOString(),
      checks: {
        database: "ok",
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "health.database.unavailable",
        requestId: req.requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }),
    );

    res.status(503).json({
      status: "unavailable",
      service: "trading-api",
      timestamp: new Date().toISOString(),
      checks: {
        database: "unavailable",
      },
    });
  }
}
