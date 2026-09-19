import express from "express";
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
import { assetsRouter } from "./routes/assets.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { overviewRouter } from "./routes/overview.routes.js";

const app = express();
app.disable("x-powered-by");

const port = process.env.PORT ? Number(process.env.PORT) : 7001;

// Security headers first, before anything else touches the request.
app.use(helmet());

// Only browsers enforce CORS — this restricts which origins a
// browser-based frontend is allowed to call this API from. Allowed
// origin(s) come from CORS_ORIGIN (config/env.ts); update it once
// apps/web's real dev/prod origin is known.
app.use(cors({ origin: env.CORS_ORIGIN }));

app.use(requestId);
app.use(generalApiRateLimiter);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ service: "trading-api", status: "ok" });
});

app.use(healthRouter);
app.use(authRouter);
app.use(portfoliosRouter);
app.use(positionsRouter);
app.use(transactionsRouter);
app.use(assetsRouter);
app.use(analyticsRouter);
app.use(overviewRouter);

// Explicit 404 for any unmatched route — routed through AppError so it
// travels the same normalized error path as every other failure.
app.use((req, _res, next) => {
  next(new AppError("NOT_FOUND", `Route not found: ${req.method} ${req.path}`, 404));
});

// Must be registered last.
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[api] listening on port ${port.toString()}`);
});
