import type { MarketPriceResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { applyPriceUpdate, type MarketPriceUpdatedEvent } from "./apply-price-update";

const usd = (amount: string) => ({ amount, currency: "USD" });

function price(assetId: string, amount: string, timestamp: string): MarketPriceResponse {
  return {
    assetId,
    price: usd(amount),
    previousPrice: usd("100.00"),
    change: usd("1.00"),
    changePercent: 1,
    timestamp,
    source: "EXTERNAL",
  };
}

function event(assetId: string, amount: string, timestamp: string): MarketPriceUpdatedEvent {
  return {
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: `market:${assetId}`,
    sequence: 7,
    timestamp,
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd(amount),
      previousPrice: usd("176.60"),
      change: usd("4.60"),
      changePercent: 2.6,
      tickChange: usd("0.10"),
    },
  };
}

const EARLIER = "2026-11-05T14:30:00.000Z";
const LATER = "2026-11-05T14:30:01.000Z";

describe("applyPriceUpdate", () => {
  it("replaces the price, the change and the time of a known asset, and keeps its source", () => {
    const prices = new Map([["a1", price("a1", "180.00", EARLIER)]]);

    const next = applyPriceUpdate(prices, event("a1", "181.20", LATER));

    expect(next.get("a1")).toEqual({
      assetId: "a1",
      price: usd("181.20"),
      previousPrice: usd("176.60"),
      change: usd("4.60"),
      changePercent: 2.6,
      timestamp: LATER,
      source: "EXTERNAL",
    });
  });

  it("leaves the other assets and the map it was given untouched", () => {
    const other = price("a2", "50.00", EARLIER);
    const prices = new Map([
      ["a1", price("a1", "180.00", EARLIER)],
      ["a2", other],
    ]);

    const next = applyPriceUpdate(prices, event("a1", "181.20", LATER));

    expect(next.get("a2")).toBe(other);
    expect(prices.get("a1")?.price).toEqual(usd("180.00"));
    expect(next).not.toBe(prices);
  });

  it("adds an asset that had no price yet, from the simulated market", () => {
    const next = applyPriceUpdate(new Map(), event("a1", "181.20", LATER));

    expect(next.get("a1")).toMatchObject({ assetId: "a1", price: usd("181.20"), source: "MOCK" });
  });

  it.each([
    ["older than", EARLIER, "2026-11-05T14:29:59.000Z"],
    ["as old as", EARLIER, EARLIER],
  ])("returns the same map when the event is %s the price it holds", (_name, held, arrived) => {
    const prices = new Map([["a1", price("a1", "180.00", held)]]);

    const next = applyPriceUpdate(prices, event("a1", "999.00", arrived));

    expect(next).toBe(prices);
  });
});
