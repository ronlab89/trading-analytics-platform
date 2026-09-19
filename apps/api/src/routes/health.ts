import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { prisma } from "@trading/database";

export const healthRouter: ExpressRouter = Router();

/**
 * Liveness — answers "is the process running?". Deliberately lightweight:
 * no dependency checks. See 13-observability-spec.md §23.
 */
healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "trading-api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness — answers "is the application ready to serve requests that
 * require its dependencies?". Runs a lightweight query against Postgres
 * through the shared @trading/database client (13-observability-spec.md
 * §23, 07-api-spec.md §30).
 *
 * Never exposes connection strings, credentials, or raw driver error
 * details in the response body (13-observability-spec.md §24) — only a
 * generic "unhealthy" status. Full detail goes to server-side logs only.
 */
healthRouter.get("/health/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

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
});
