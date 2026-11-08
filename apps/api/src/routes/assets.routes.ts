import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  assetHistoryQuerySchema,
  assetIdParamsSchema,
  listAssetsQuerySchema,
} from "@trading/contracts";
import { makeAssetsController } from "../controllers/assets.controller.js";
import { composition } from "../composition.js";

const { getAssetByIdHandler, getAssetHistoryHandler, getAssetPriceHandler, listAssetsHandler } =
  makeAssetsController(composition.assetService, composition.marketService);

export const assetsRouter: ExpressRouter = Router();

assetsRouter.get(
  "/api/v1/assets",
  authenticate,
  validate(listAssetsQuerySchema, "query"),
  listAssetsHandler,
);

assetsRouter.get(
  "/api/v1/assets/:assetId",
  authenticate,
  validate(assetIdParamsSchema, "params"),
  getAssetByIdHandler,
);

assetsRouter.get(
  "/api/v1/assets/:assetId/price",
  authenticate,
  validate(assetIdParamsSchema, "params"),
  getAssetPriceHandler,
);

assetsRouter.get(
  "/api/v1/assets/:assetId/history",
  authenticate,
  validate(assetIdParamsSchema, "params"),
  validate(assetHistoryQuerySchema, "query"),
  getAssetHistoryHandler,
);
