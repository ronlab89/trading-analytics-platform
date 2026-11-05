import type { OverviewResponse, PositionResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import type { MarketPriceUpdatedEvent } from "@/features/watchlist/lib/apply-price-update";
import { applyPriceToOverview } from "./apply-price-to-overview";

const usd = (amount: string) => ({ amount, currency: "USD" });

const WRITTEN = "2026-11-05T14:00:00.000Z";
const LATER = "2026-11-05T14:30:01.000Z";

function position(id: string, assetId: string, quantity: number, average: string, price: string) {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity,
    averageEntryPrice: usd(average),
    currentPrice: usd(price),
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: WRITTEN,
  } satisfies PositionResponse;
}

function entry(held: PositionResponse, marketValue: string, costBasis: string, pnl: string) {
  return {
    position: held,
    asset: null,
    metrics: {
      marketValue: usd(marketValue),
      costBasis: usd(costBasis),
      unrealizedPnL: usd(pnl),
      unrealizedPnLPercent: 0,
    },
    allocationPercent: 50,
    dailyChange: { changeValue: usd("12.00"), changePercent: 0.5 },
  };
}

// AAPL: 10 at 150 now 180 (value 1800, cost 1500); MSFT: 5 at 40 now 50 (value 250, cost 200).
function overview() {
  return {
    portfolio: {
      id: "p1",
      userId: "u1",
      name: "Main",
      description: null,
      baseCurrency: "USD",
      status: "ACTIVE" as const,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    summary: {
      totalValue: usd("2050.00"),
      investedValue: usd("2050.00"),
      unrealizedPnL: usd("350.00"),
      unrealizedPnLPercent: 20.58,
    },
    positions: [
      entry(position("s1", "a1", 10, "150.00", "180.00"), "1800.00", "1500.00", "300.00"),
      entry(position("s2", "a2", 5, "40.00", "50.00"), "250.00", "200.00", "50.00"),
    ],
  } satisfies Pick<OverviewResponse, "portfolio" | "summary" | "positions">;
}

function tick(assetId: string, amount: string, timestamp = LATER): MarketPriceUpdatedEvent {
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

const value = (money: { amount: string }) => Number(money.amount);

describe("applyPriceToOverview", () => {
  it("gives the position its new price and calculates its metrics again", () => {
    const next = applyPriceToOverview(overview(), tick("a1", "190.00"));

    const { position, metrics } = next.positions[0] ?? expect.unreachable("no first position");
    expect(position.currentPrice).toEqual(usd("190.00"));
    expect(value(metrics.marketValue)).toBe(1900);
    expect(value(metrics.costBasis)).toBe(1500);
    expect(value(metrics.unrealizedPnL)).toBe(400);
    expect(metrics.unrealizedPnLPercent).toBeCloseTo(26.6667, 3);
  });

  it("calculates the summary again with every position", () => {
    const { summary } = applyPriceToOverview(overview(), tick("a1", "190.00"));

    expect(value(summary.totalValue)).toBe(2150);
    expect(value(summary.investedValue)).toBe(2150);
    expect(value(summary.unrealizedPnL)).toBe(450);
    expect(summary.unrealizedPnLPercent).toBeCloseTo(26.4706, 3);
  });

  it("leaves the other positions and what the client cannot calculate as the server sent it", () => {
    const before = overview();

    const next = applyPriceToOverview(before, tick("a1", "190.00"));

    expect(next.positions[1]).toBe(before.positions[1]);
    expect(next.positions[0]?.allocationPercent).toBe(50);
    expect(next.positions[0]?.dailyChange).toEqual({
      changeValue: usd("12.00"),
      changePercent: 0.5,
    });
    expect(next.portfolio).toBe(before.portfolio);
  });

  it("does not touch the overview it was given", () => {
    const before = overview();

    applyPriceToOverview(before, tick("a1", "190.00"));

    expect(before).toEqual(overview());
  });

  it("keeps any other part of the overview", () => {
    const before = { ...overview(), pulse: "kept" };

    expect(applyPriceToOverview(before, tick("a1", "190.00")).pulse).toBe("kept");
  });

  it("returns the same overview when no position holds the asset", () => {
    const before = overview();

    expect(applyPriceToOverview(before, tick("a9", "10.00"))).toBe(before);
  });

  it("returns the same overview when the event is not newer than the position", () => {
    const before = overview();

    expect(applyPriceToOverview(before, tick("a1", "999.00", WRITTEN))).toBe(before);
  });

  it("returns the same overview when the numbers cannot be calculated", () => {
    const before = overview();
    before.positions[0] = entry(
      position("s1", "a1", 10, "0.00", "180.00"),
      "1800.00",
      "0.00",
      "1800.00",
    );

    expect(applyPriceToOverview(before, tick("a1", "190.00"))).toBe(before);
  });
});
