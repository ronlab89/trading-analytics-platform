import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createPortfolioRequestSchema,
  updatePortfolioRequestSchema,
} from "../schemas/portfolio.schema.js";
import {
  archivePortfolioHandler,
  createPortfolioHandler,
  getPortfolioByIdHandler,
  listPortfoliosHandler,
  updatePortfolioHandler,
} from "../controllers/portfolios.controller.js";

export const portfoliosRouter: ExpressRouter = Router();

portfoliosRouter.get("/api/v1/portfolios", authenticate, listPortfoliosHandler);

portfoliosRouter.post(
  "/api/v1/portfolios",
  authenticate,
  validate(createPortfolioRequestSchema, "body"),
  createPortfolioHandler,
);

portfoliosRouter.get("/api/v1/portfolios/:portfolioId", authenticate, getPortfolioByIdHandler);

portfoliosRouter.patch(
  "/api/v1/portfolios/:portfolioId",
  authenticate,
  validate(updatePortfolioRequestSchema, "body"),
  updatePortfolioHandler,
);

portfoliosRouter.post(
  "/api/v1/portfolios/:portfolioId/archive",
  authenticate,
  archivePortfolioHandler,
);
