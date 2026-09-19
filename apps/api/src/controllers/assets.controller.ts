import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { listAssetsQuerySchema } from "../schemas/asset.schema.js";
import { buildPaginationMeta } from "../schemas/pagination.schema.js";
import { getAssetById, listAssets } from "../services/asset.service.js";

type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;

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
