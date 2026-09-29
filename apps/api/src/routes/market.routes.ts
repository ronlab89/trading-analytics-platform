import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { batchPricesQuerySchema } from "../schemas/market.schema.js";
import { getBatchPricesHandler } from "../controllers/market.controller.js";

export const marketRouter: ExpressRouter = Router();

marketRouter.get(
  "/api/v1/market/prices",
  authenticate,
  validate(batchPricesQuerySchema, "query"),
  getBatchPricesHandler,
);
