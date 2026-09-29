import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { batchPricesQuerySchema } from "../schemas/market.schema.js";
import { getBatchPrices } from "../services/market.service.js";

type BatchPricesQuery = z.infer<typeof batchPricesQuerySchema>;

/**
 * GET /api/v1/market/prices
 * Source: 07-api-spec.md §19 (Market Data Batch Endpoint), FR-044.
 *
 * Query validated upstream by `validate(batchPricesQuerySchema, "query")`.
 */
export async function getBatchPricesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetIds } = req.validated?.query as BatchPricesQuery;

  try {
    const prices = await getBatchPrices(assetIds);
    res.json({ data: prices });
  } catch (error) {
    next(error);
  }
}
