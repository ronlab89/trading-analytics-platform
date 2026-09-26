import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { listAssetsQuerySchema } from "../schemas/asset.schema.js";
import type { assetHistoryQuerySchema } from "../schemas/market.schema.js";
import { buildPaginationMeta } from "../schemas/pagination.schema.js";
import { getAssetById, listAssets } from "../services/asset.service.js";
import { getAssetHistory, getAssetPrice } from "../services/market.service.js";

type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
type AssetHistoryQuery = z.infer<typeof assetHistoryQuerySchema>;

/**
 * GET /api/v1/assets
 * Source: 07-api-spec.md §17 (List Assets), FR-019/FR-020.
 *
 * Query validated upstream by `validate(listAssetsQuerySchema, "query")`.
 */
export async function listAssetsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { search, assetType, exchange, currency, status, page, pageSize } = req.validated
    ?.query as ListAssetsQuery;

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
}

/**
 * GET /api/v1/assets/:assetId
 * Source: 07-api-spec.md §17 (Get Asset), FR-021.
 */
export async function getAssetByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const asset = await getAssetById(req.params.assetId as string);
    res.json({ data: asset });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/assets/:assetId/price
 * Source: 07-api-spec.md §17 (Asset Price), FR-021.
 */
export async function getAssetPriceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const price = await getAssetPrice(req.params.assetId as string);
    res.json({ data: price });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/assets/:assetId/history
 * Source: 07-api-spec.md §18 (Historical Market Data), FR-026.
 *
 * Query validated upstream by `validate(assetHistoryQuerySchema, "query")`.
 */
export async function getAssetHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { from, to } = req.validated?.query as AssetHistoryQuery;

  try {
    const candles = await getAssetHistory(req.params.assetId as string, from, to);
    res.json({ data: candles });
  } catch (error) {
    next(error);
  }
}
