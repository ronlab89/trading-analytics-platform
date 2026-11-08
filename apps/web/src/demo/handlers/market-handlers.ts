import {
  buildPaginationMeta,
  presentAsset,
  presentHistoricalPrice,
  presentMarketPrice,
} from "@trading/contracts";
import type {
  assetHistoryQuerySchema,
  batchPricesQuerySchema,
  listAssetsQuerySchema,
} from "@trading/contracts";
import type { z } from "zod";
import type { HandlerContext, HandlerRegistry } from "./handler";

type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
type AssetHistoryQuery = z.infer<typeof assetHistoryQuerySchema>;
type BatchPricesQuery = z.infer<typeof batchPricesQuerySchema>;

interface AssetParams {
  readonly assetId: string;
}

/** Mirrors `assets.controller.ts` and `market.controller.ts` of the API, on the same services. */
export function createMarketHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { assetService, marketService, actor } = composition;

  return {
    listAssets: async ({ query }) => {
      const { search, assetType, exchange, currency, status, page, pageSize } =
        query as ListAssetsQuery;
      const result = await assetService.listAssets(
        actor,
        {
          ...(search !== undefined ? { search } : {}),
          ...(assetType !== undefined ? { assetType } : {}),
          ...(exchange !== undefined ? { exchange } : {}),
          ...(currency !== undefined ? { currency } : {}),
          ...(status !== undefined ? { status } : {}),
        },
        { page, pageSize },
      );
      return {
        data: result.items.map(presentAsset),
        meta: buildPaginationMeta(page, pageSize, result.total),
      };
    },
    getAsset: async ({ params }) => {
      const { assetId } = params as AssetParams;
      return { data: presentAsset(await assetService.getAssetById(actor, assetId)) };
    },
    getAssetPrice: async ({ params }) => {
      const { assetId } = params as AssetParams;
      return { data: presentMarketPrice(await marketService.getAssetPrice(actor, assetId)) };
    },
    getAssetHistory: async ({ params, query }) => {
      const { assetId } = params as AssetParams;
      const { from, to } = query as AssetHistoryQuery;
      const candles = await marketService.getAssetHistory(actor, assetId, from, to);
      return { data: candles.map(presentHistoricalPrice) };
    },
    getMarketPrices: async ({ query }) => {
      const { assetIds } = query as BatchPricesQuery;
      const prices = await marketService.getBatchPrices(actor, assetIds);
      return { data: prices.map(presentMarketPrice) };
    },
  };
}
