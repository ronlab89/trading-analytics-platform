import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { listAssetsQuerySchema } from "../schemas/asset.schema.js";
import { assetHistoryQuerySchema } from "../schemas/market.schema.js";
import {
  getAssetByIdHandler,
  getAssetHistoryHandler,
  getAssetPriceHandler,
  listAssetsHandler,
} from "../controllers/assets.controller.js";

export const assetsRouter: ExpressRouter = Router();

assetsRouter.get(
  "/api/v1/assets",
  authenticate,
  validate(listAssetsQuerySchema, "query"),
  listAssetsHandler,
);

assetsRouter.get("/api/v1/assets/:assetId", authenticate, getAssetByIdHandler);

assetsRouter.get("/api/v1/assets/:assetId/price", authenticate, getAssetPriceHandler);

assetsRouter.get(
  "/api/v1/assets/:assetId/history",
  authenticate,
  validate(assetHistoryQuerySchema, "query"),
  getAssetHistoryHandler,
);
