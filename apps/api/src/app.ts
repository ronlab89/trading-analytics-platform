import express from "express";
import type { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { requestId } from "./middleware/request-id.js";
import { generalApiRateLimiter } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { AppError } from "./errors/app-error.js";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.routes.js";
import { portfoliosRouter } from "./routes/portfolios.routes.js";
import { positionsRouter } from "./routes/positions.routes.js";
import { transactionsRouter } from "./routes/transactions.routes.js";
import { decisionsRouter } from "./routes/decisions.routes.js";
import { scenariosRouter } from "./routes/scenarios.routes.js";
import { assetsRouter } from "./routes/assets.routes.js";
import { marketRouter } from "./routes/market.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { overviewRouter } from "./routes/overview.routes.js";
import { watchlistRouter } from "./routes/watchlist.routes.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { preferencesRouter } from "./routes/preferences.routes.js";

// Explicit body-size ceiling (09-security-spec.md §27). 100kb matches the
// Express default but is stated here so it is a deliberate, visible limit.
const JSON_BODY_LIMIT = "100kb";

/**
 * Builds a fully configured Express application, without starting an
 * HTTP listener. Kept separate from index.ts so integration tests
 * (supertest) can exercise the real middleware/routing stack in-process,
 * without binding a port (10-testing-strategy.md §32, "Playwright/API
 * integration tests should validate the interaction between HTTP,
 * middleware, validation, application service, repository").
 *
 * Every call returns a fresh Express instance; no module-level mutable
 * state is shared between calls, so tests can create as many app
 * instances as needed without interfering with each other.
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  // Security headers first, before anything else touches the request.
  app.use(helmet());

  // Only browsers enforce CORS — this restricts which origins a
  // browser-based frontend is allowed to call this API from. Allowed
  // origin(s) come from CORS_ORIGIN (config/env.ts); update it once
  // apps/web's real dev/prod origin is known.
  app.use(cors({ origin: env.CORS_ORIGIN }));

  app.use(requestId);

  // Health endpoints are registered before the rate limiter on purpose:
  // orchestrators and uptime monitors poll them frequently and must
  // never receive a 429 (14-deployment-spec.md §50-51). They are cheap
  // and expose no user data.
  app.use(healthRouter);

  app.use(generalApiRateLimiter);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.get("/", (_req, res) => {
    res.json({ service: "trading-api", status: "ok" });
  });

  app.use(authRouter);
  app.use(portfoliosRouter);
  app.use(positionsRouter);
  app.use(transactionsRouter);
  app.use(decisionsRouter);
  app.use(scenariosRouter);
  app.use(assetsRouter);
  app.use(marketRouter);
  app.use(analyticsRouter);
  app.use(overviewRouter);
  app.use(watchlistRouter);
  app.use(alertsRouter);
  app.use(notificationsRouter);
  app.use(preferencesRouter);

  // Explicit 404 for any unmatched route — routed through AppError so
  // it travels the same normalized error path as every other failure.
  app.use((req, _res, next) => {
    next(new AppError("NOT_FOUND", `Route not found: ${req.method} ${req.path}`, 404));
  });

  // Must be registered last.
  app.use(errorHandler);

  return app;
}
