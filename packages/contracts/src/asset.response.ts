import { z } from "zod";
import { AssetStatus, AssetType, MarketDataSource } from "@trading/domain";
import type { Asset, HistoricalPrice, MarketPrice } from "@trading/domain";
import {
  isoTimestampSchema,
  moneySchema,
  presentMoney,
  presentTimestamp,
} from "./response-common.schema.js";

const assetTypeValues = Object.values(AssetType) as [AssetType, ...AssetType[]];
const assetStatusValues = Object.values(AssetStatus) as [AssetStatus, ...AssetStatus[]];
const marketDataSourceValues = Object.values(MarketDataSource) as [
  MarketDataSource,
  ...MarketDataSource[],
];

/**
 * Response shapes for the asset and market endpoints.
 * Source: 07-api-spec.md (Assets, Market), 05-data-model.md §7, §17, §18.
 */
export const assetResponseSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  assetType: z.enum(assetTypeValues),
  currency: z.string(),
  exchange: z.string(),
  status: z.enum(assetStatusValues),
  metadata: z.record(z.string(), z.unknown()),
});
export type AssetResponse = z.infer<typeof assetResponseSchema>;

export const marketPriceResponseSchema = z.object({
  assetId: z.string(),
  price: moneySchema,
  previousPrice: moneySchema,
  change: moneySchema,
  changePercent: z.number(),
  timestamp: isoTimestampSchema,
  source: z.enum(marketDataSourceValues),
});
export type MarketPriceResponse = z.infer<typeof marketPriceResponseSchema>;

export const historicalPriceResponseSchema = z.object({
  assetId: z.string(),
  timestamp: isoTimestampSchema,
  open: moneySchema,
  high: moneySchema,
  low: moneySchema,
  close: moneySchema,
  volume: z.number(),
});
export type HistoricalPriceResponse = z.infer<typeof historicalPriceResponseSchema>;

export function presentAsset(asset: Asset): AssetResponse {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.assetType,
    currency: asset.currency,
    exchange: asset.exchange,
    status: asset.status,
    metadata: { ...asset.metadata },
  };
}

export function presentMarketPrice(price: MarketPrice): MarketPriceResponse {
  return {
    assetId: price.assetId,
    price: presentMoney(price.price),
    previousPrice: presentMoney(price.previousPrice),
    change: presentMoney(price.change),
    changePercent: price.changePercent,
    timestamp: presentTimestamp(price.timestamp),
    source: price.source,
  };
}

export function presentHistoricalPrice(candle: HistoricalPrice): HistoricalPriceResponse {
  return {
    assetId: candle.assetId,
    timestamp: presentTimestamp(candle.timestamp),
    open: presentMoney(candle.open),
    high: presentMoney(candle.high),
    low: presentMoney(candle.low),
    close: presentMoney(candle.close),
    volume: candle.volume,
  };
}
