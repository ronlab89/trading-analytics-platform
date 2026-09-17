import express from "express";
import { requestId } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { AppError } from "./errors/app-error.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.routes.js";

const app = express();
app.disable("x-powered-by");

const port = process.env.PORT ? Number(process.env.PORT) : 7001;

app.use(requestId);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ service: "trading-api", status: "ok" });
});

app.use(healthRouter);
app.use(authRouter);

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
