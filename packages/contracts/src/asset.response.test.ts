import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Asset, HistoricalPrice, MarketPrice } from "@trading/domain";
import {
  assetResponseSchema,
  historicalPriceResponseSchema,
  marketPriceResponseSchema,
  presentAsset,
  presentHistoricalPrice,
  presentMarketPrice,
} from "./asset.response.js";

const asset: Asset = {
  id: "a1",
  symbol: "BTC",
  name: "Bitcoin",
  assetType: "CRYPTO",
  currency: "USD",
  exchange: "MOCK",
  status: "ACTIVE",
  metadata: { sector: "crypto" },
};

const price: MarketPrice = {
  assetId: "a1",
  price: Money.of("101.25", "USD"),
  previousPrice: Money.of("100", "USD"),
  change: Money.of("1.25", "USD"),
  changePercent: 1.25,
  timestamp: new Date("2026-10-13T12:00:00.000Z"),
  source: "MOCK",
};

const candle: HistoricalPrice = {
  assetId: "a1",
  timestamp: new Date("2026-10-13T00:00:00.000Z"),
  open: Money.of("100", "USD"),
  high: Money.of("110.5", "USD"),
  low: Money.of("99", "USD"),
  close: Money.of("105", "USD"),
  volume: 1234,
};

describe("asset presenters", () => {
  it("serializes an asset exactly as before", () => {
    const dto = presentAsset(asset);
    expect(dto).toEqual(JSON.parse(JSON.stringify(asset)));
    expect(assetResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes a market price exactly as before, money as decimal strings", () => {
    const dto = presentMarketPrice(price);
    expect(dto).toEqual(JSON.parse(JSON.stringify(price)));
    expect(dto.price).toEqual({ amount: "101.25", currency: "USD" });
    expect(marketPriceResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes a candle exactly as before", () => {
    const dto = presentHistoricalPrice(candle);
    expect(dto).toEqual(JSON.parse(JSON.stringify(candle)));
    expect(historicalPriceResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    expect(Object.keys(presentAsset({ ...asset, extra: 1 } as Asset)).sort()).toEqual(
      ["assetType", "currency", "exchange", "id", "metadata", "name", "status", "symbol"].sort(),
    );
    expect(Object.keys(presentMarketPrice({ ...price, extra: 1 } as MarketPrice)).sort()).toEqual(
      [
        "assetId",
        "change",
        "changePercent",
        "previousPrice",
        "price",
        "source",
        "timestamp",
      ].sort(),
    );
  });
});
