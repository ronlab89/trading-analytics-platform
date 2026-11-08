import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentMarketPrice } from "@trading/contracts";
import type { batchPricesQuerySchema } from "@trading/contracts";
import type { MarketService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type BatchPricesQuery = z.infer<typeof batchPricesQuerySchema>;

/** Market HTTP handlers, bound to the market use cases they call. */
export function makeMarketController(marketService: MarketService) {
  /**
   * GET /api/v1/market/prices
   * Source: 07-api-spec.md §19 (Market Data Batch Endpoint), FR-044.
   *
   * Query validated upstream by `validate(batchPricesQuerySchema, "query")`.
   */
  async function getBatchPricesHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetIds } = req.validated?.query as BatchPricesQuery;

    try {
      const prices = await marketService.getBatchPrices(actorOf(req), assetIds);
      res.json({ data: prices.map(presentMarketPrice) });
    } catch (error) {
      next(error);
    }
  }

  return {
    getBatchPricesHandler,
  };
}
