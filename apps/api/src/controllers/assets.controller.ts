import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import {
  buildPaginationMeta,
  presentAsset,
  presentHistoricalPrice,
  presentMarketPrice,
  type assetHistoryQuerySchema,
  type listAssetsQuerySchema,
} from "@trading/contracts";
import type { AssetService, MarketService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
type AssetHistoryQuery = z.infer<typeof assetHistoryQuerySchema>;

/** Asset HTTP handlers, bound to the asset and market use cases they call. */
export function makeAssetsController(assetService: AssetService, marketService: MarketService) {
  /**
   * GET /api/v1/assets
   * Source: 07-api-spec.md §17 (List Assets), FR-019/FR-020.
   *
   * Query validated upstream by `validate(listAssetsQuerySchema, "query")`.
   */
  async function listAssetsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { search, assetType, exchange, currency, status, page, pageSize } = req.validated
      ?.query as ListAssetsQuery;

    try {
      const result = await assetService.listAssets(
        actorOf(req),
        {
          ...(search !== undefined ? { search } : {}),
          ...(assetType !== undefined ? { assetType } : {}),
          ...(exchange !== undefined ? { exchange } : {}),
          ...(currency !== undefined ? { currency } : {}),
          ...(status !== undefined ? { status } : {}),
        },
        { page, pageSize },
      );
      res.json({
        data: result.items.map(presentAsset),
        meta: buildPaginationMeta(page, pageSize, result.total),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assets/:assetId
   * Source: 07-api-spec.md §17 (Get Asset), FR-021.
   */
  async function getAssetByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const asset = await assetService.getAssetById(actorOf(req), req.params.assetId as string);
      res.json({ data: presentAsset(asset) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assets/:assetId/price
   * Source: 07-api-spec.md §17 (Asset Price), FR-021.
   */
  async function getAssetPriceHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const price = await marketService.getAssetPrice(actorOf(req), req.params.assetId as string);
      res.json({ data: presentMarketPrice(price) });
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
  async function getAssetHistoryHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { from, to } = req.validated?.query as AssetHistoryQuery;

    try {
      const candles = await marketService.getAssetHistory(
        actorOf(req),
        req.params.assetId as string,
        from,
        to,
      );
      res.json({ data: candles.map(presentHistoricalPrice) });
    } catch (error) {
      next(error);
    }
  }

  return {
    listAssetsHandler,
    getAssetByIdHandler,
    getAssetPriceHandler,
    getAssetHistoryHandler,
  };
}
