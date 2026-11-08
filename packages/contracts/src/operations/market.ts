import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import {
  assetResponseSchema,
  historicalPriceResponseSchema,
  marketPriceResponseSchema,
} from "../asset.response.js";
import { listAssetsQuerySchema } from "../asset.schema.js";
import { assetHistoryQuerySchema, batchPricesQuerySchema } from "../market.schema.js";
import { assetIdParamsSchema } from "../params.schema.js";
import { dataEnvelope, pageEnvelope } from "../response-common.schema.js";

/** Assets and market prices (07-api-spec.md §15-§18). */
export const marketOperations: readonly ApiOperation[] = [
  {
    operationId: "listAssets",
    method: "get",
    path: "/api/v1/assets",
    tag: "Assets",
    summary: "List the assets",
    authenticated: true,
    query: listAssetsQuerySchema,
    success: {
      status: 200,
      description: "A page of assets.",
      schema: pageEnvelope(assetResponseSchema),
    },
    errors: [400, 401, 403, 429],
  },
  {
    operationId: "getAsset",
    method: "get",
    path: "/api/v1/assets/:assetId",
    tag: "Assets",
    summary: "Get an asset",
    authenticated: true,
    params: assetIdParamsSchema,
    success: {
      status: 200,
      description: "The asset.",
      schema: dataEnvelope(assetResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getAssetPrice",
    method: "get",
    path: "/api/v1/assets/:assetId/price",
    tag: "Assets",
    summary: "Get the current price of an asset",
    description: "404 when the asset has no current price yet.",
    authenticated: true,
    params: assetIdParamsSchema,
    success: {
      status: 200,
      description: "The current price.",
      schema: dataEnvelope(marketPriceResponseSchema),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getAssetHistory",
    method: "get",
    path: "/api/v1/assets/:assetId/history",
    tag: "Assets",
    summary: "Get the daily candles of an asset",
    description: "Only the `1d` interval exists.",
    authenticated: true,
    params: assetIdParamsSchema,
    query: assetHistoryQuerySchema,
    success: {
      status: 200,
      description: "The candles in the range.",
      schema: dataEnvelope(z.array(historicalPriceResponseSchema)),
    },
    errors: [400, 401, 403, 404, 429],
  },
  {
    operationId: "getMarketPrices",
    method: "get",
    path: "/api/v1/market/prices",
    tag: "Market",
    summary: "Get the current prices of several assets",
    description: "`assetIds` is a comma-separated list of 1 to 50 asset ids.",
    authenticated: true,
    query: batchPricesQuerySchema,
    success: {
      status: 200,
      description: "The current prices.",
      schema: dataEnvelope(z.array(marketPriceResponseSchema)),
    },
    errors: [400, 401, 403, 429],
  },
];
