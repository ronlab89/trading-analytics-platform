import type { PositionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import type { MarketPriceUpdatedEvent } from "@/features/watchlist/lib/apply-price-update";
import { applyPriceToPositions } from "./apply-price-to-positions";

const usd = (amount: string) => ({ amount, currency: "USD" });

const WRITTEN = "2026-11-05T14:00:00.000Z";
const LATER = "2026-11-05T14:30:01.000Z";

function position(id: string, assetId: string, price = "180.00", updatedAt = WRITTEN) {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity: 10,
    averageEntryPrice: usd("150.00"),
    currentPrice: usd(price),
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt,
  } satisfies PositionResponse;
}

function tick(assetId: string, amount: string, timestamp: string): MarketPriceUpdatedEvent {
  return {
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: `market:${assetId}`,
    sequence: 1,
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

describe("applyPriceToPositions", () => {
  it("gives the position of that asset its new price and leaves the rest as it was", () => {
    const first = position("pos1", "a1");
    const other = position("pos2", "a2", "50.00");

    const next = applyPriceToPositions([first, other], tick("a1", "181.20", LATER));

    expect(next[0]).toEqual({ ...first, currentPrice: usd("181.20") });
    expect(next[1]).toBe(other);
  });

  it("does not touch the array it was given", () => {
    const positions = [position("pos1", "a1")];

    applyPriceToPositions(positions, tick("a1", "181.20", LATER));

    expect(positions[0]?.currentPrice).toEqual(usd("180.00"));
  });

  it("updates every position of the asset", () => {
    const next = applyPriceToPositions(
      [position("pos1", "a1"), position("pos2", "a1")],
      tick("a1", "181.20", LATER),
    );

    expect(next.map((p) => p.currentPrice.amount)).toEqual(["181.20", "181.20"]);
  });

  it("returns the same array when no position holds the asset", () => {
    const positions = [position("pos1", "a1")];

    expect(applyPriceToPositions(positions, tick("a9", "10.00", LATER))).toBe(positions);
  });

  it.each([
    ["older than", "2026-11-05T13:59:59.000Z"],
    ["as old as", WRITTEN],
  ])("returns the same array when the event is %s the position", (_name, arrivedAt) => {
    const positions = [position("pos1", "a1")];

    expect(applyPriceToPositions(positions, tick("a1", "999.00", arrivedAt))).toBe(positions);
  });

  it("returns the same array for no positions", () => {
    const none: PositionResponse[] = [];

    expect(applyPriceToPositions(none, tick("a1", "181.20", LATER))).toBe(none);
  });
});
