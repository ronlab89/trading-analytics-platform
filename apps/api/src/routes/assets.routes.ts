import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { listAssetsQuerySchema } from "../schemas/asset.schema.js";
import { buildPaginationMeta } from "../schemas/pagination.schema.js";
import { getAssetById, listAssets } from "../services/asset.service.js";
import { AppError } from "../errors/app-error.js";

export const assetsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/assets
 * Source: 07-api-spec.md §17 (List Assets), FR-019/FR-020.
 */
assetsRouter.get("/api/v1/assets", authenticate, async (req, res, next) => {
  const parsedQuery = listAssetsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    next(
      new AppError(
        "VALIDATION_ERROR",
        "The request contains invalid query parameters.",
        400,
        parsedQuery.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
    return;
  }

  const { search, assetType, exchange, currency, status, page, pageSize } = parsedQuery.data;

  try {
    const result = await listAssets(
      {
        ...(search !== undefined ? { search } : {}),
        ...(assetType !== undefined ? { assetType } : {}),
        ...(exchange !== undefined ? { exchange } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      { page, pageSize },
    );
    res.json({ data: result.items, meta: buildPaginationMeta(page, pageSize, result.total) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assets/:assetId
 * Source: 07-api-spec.md §17 (Get Asset), FR-021.
 */
assetsRouter.get("/api/v1/assets/:assetId", authenticate, async (req, res, next) => {
  try {
    const asset = await getAssetById(req.params.assetId as string);
    res.json({ data: asset });
  } catch (error) {
    next(error);
  }
});
