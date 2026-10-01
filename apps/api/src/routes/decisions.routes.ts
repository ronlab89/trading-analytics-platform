import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { listDecisionsQuerySchema } from "../schemas/decision.schema.js";
import {
  getDecisionByIdHandler,
  getDecisionReplayHandler,
  listDecisionsHandler,
} from "../controllers/decisions.controller.js";

export const decisionsRouter: ExpressRouter = Router();

decisionsRouter.get(
  "/api/v1/portfolios/:portfolioId/decisions",
  authenticate,
  validate(listDecisionsQuerySchema, "query"),
  listDecisionsHandler,
);

decisionsRouter.get(
  "/api/v1/portfolios/:portfolioId/decisions/:decisionId",
  authenticate,
  getDecisionByIdHandler,
);

// Not nested under /portfolios/:portfolioId, per 07-api-spec.md §24.
// Ownership is resolved in the service (decision -> portfolio -> user).
decisionsRouter.get("/api/v1/decisions/:decisionId/replay", authenticate, getDecisionReplayHandler);
