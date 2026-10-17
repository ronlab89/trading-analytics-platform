import { describe, expect, it } from "vitest";
import { Money, TransactionType } from "@trading/domain";
import type { HistoricalPrice, Portfolio, Transaction } from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createPerformanceService } from "./performance-service.js";

const actor: Actor = { userId: "u1", role: "USER" };
const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

// 2026-03-31 is the last closed UTC day.
const clock = fixedClock(new Date("2026-04-01T12:00:00Z"));

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function buy(assetId: string, executedAt: string, quantity = 1, price = "100"): Transaction {
  return {
    id: `t-${assetId}-${executedAt}`,
    portfolioId: "p1",
    assetId,
    type: TransactionType.BUY,
    quantity,
    price: Money.of(price, "USD"),
    fees: Money.zero("USD"),
    status: "COMPLETED",
    executedAt: day(executedAt),
  } as Transaction;
}

function candle(assetId: string, date: string, close: number): HistoricalPrice {
  return { assetId, timestamp: day(date), close: Money.of(close, "USD") } as HistoricalPrice;
}

function build(
  options: {
    transactions?: Transaction[];
    prices?: HistoricalPrice[];
    owned?: boolean;
    permissions?: RolePermissions;
  } = {},
) {
  const { transactions = [], prices = [], owned = true, permissions } = options;
  return createPerformanceService({
    portfolioService: {
      getPortfolioById: () =>
        owned
          ? Promise.resolve(portfolio)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    transactionRepository: { listCompletedByPortfolioId: () => Promise.resolve(transactions) },
    historicalPriceRepository: {
      listByAssetIds: (ids, from, to) =>
        Promise.resolve(
          prices.filter(
            (p) =>
              ids.includes(p.assetId) &&
              p.timestamp.getTime() >= from.getTime() &&
              p.timestamp.getTime() <= to.getTime(),
          ),
        ),
    },
    clock,
    ...(permissions ? { permissions } : {}),
  });
}

// One unit bought on 2026-03-27 at 100, closing 100, 110, 99, 99 and 99 up to 2026-03-31.
const held = {
  transactions: [buy("a1", "2026-03-27")],
  prices: [
    candle("a1", "2026-03-27", 100),
    candle("a1", "2026-03-28", 110),
    candle("a1", "2026-03-29", 99),
    candle("a1", "2026-03-30", 99),
    candle("a1", "2026-03-31", 99),
  ],
};

describe("performance service", () => {
  it("measures TWR and P/L and returns one point per day of the period", async () => {
    // Custom range 2026-03-28..2026-03-31, baseline 2026-03-27 (V = 100).
    const result = await build(held).getPortfolioPerformance(actor, "p1", {
      kind: "custom",
      from: day("2026-03-28"),
      to: day("2026-03-31"),
    });

    expect(result.status).toBe("OK");
    expect(result.asOf).toEqual(day("2026-03-31"));
    expect(result.effectiveFrom).toEqual(day("2026-03-28"));
    // r = +10%, -10%, 0%, 0%: TWR = 1.10 x 0.90 - 1 = -1%.
    expect(result.twr?.toFixed(6)).toBe("-0.010000");
    expect(result.pnl?.toString()).toBe("-1");
    expect(result.series.map((point) => point.date)).toEqual([
      day("2026-03-28"),
      day("2026-03-29"),
      day("2026-03-30"),
      day("2026-03-31"),
    ]);
    expect(result.series.map((point) => point.value?.toString())).toEqual([
      "110",
      "99",
      "99",
      "99",
    ]);
    expect(result.series.map((point) => point.returnRate?.toFixed(2))).toEqual([
      "0.10",
      "-0.10",
      "0.00",
      "0.00",
    ]);
  });

  it("values the days before the first purchase at zero, without a return", async () => {
    const result = await build(held).getPortfolioPerformance(actor, "p1", {
      kind: "preset",
      period: "1M",
    });

    // 1M reaches back to 2026-03-01: nothing is held until the BUY on 2026-03-27.
    expect(result.effectiveFrom).toEqual(day("2026-03-01"));
    expect(result.series).toHaveLength(31);
    expect(result.series[0]?.value?.isZero()).toBe(true);
    expect(result.series[0]?.returnRate).toBeNull();
    expect(result.twr?.toFixed(6)).toBe("-0.010000");
  });

  it("clamps a period that starts before the first price and states effectiveFrom", async () => {
    // Held from 2026-03-27 but the first close is dated 2026-03-29.
    const result = await build({
      transactions: held.transactions,
      prices: held.prices.slice(2),
    }).getPortfolioPerformance(actor, "p1", { kind: "preset", period: "1M" });

    // The first priced day is the baseline: it has a value but no return.
    expect(result.effectiveFrom).toEqual(day("2026-03-29"));
    expect(result.series[0]).toMatchObject({ date: day("2026-03-29"), returnRate: null });
    expect(result.series).toHaveLength(3);
  });

  it("clamps a `to` after the last closed day and reports asOf", async () => {
    const result = await build(held).getPortfolioPerformance(actor, "p1", {
      kind: "custom",
      from: day("2026-03-28"),
      to: day("2026-04-02"),
    });

    expect(result.asOf).toEqual(day("2026-03-31"));
    expect(result.series.at(-1)?.date).toEqual(day("2026-03-31"));
  });

  it("is INSUFFICIENT_DATA with no values when `from` is after the last closed day", async () => {
    const result = await build(held).getPortfolioPerformance(actor, "p1", {
      kind: "custom",
      from: day("2026-04-01"),
    });

    expect(result).toEqual({
      asOf: day("2026-03-31"),
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      twr: null,
      pnl: null,
      series: [],
    });
  });

  it("is INSUFFICIENT_DATA when a held asset has no price on the last day", async () => {
    const result = await build({ transactions: [buy("a1", "2026-03-27")] }).getPortfolioPerformance(
      actor,
      "p1",
      { kind: "preset", period: "1W" },
    );

    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.pnl).toBeNull();
    expect(result.series).toEqual([]);
  });

  it("reports a zero P/L and no TWR for a portfolio without transactions", async () => {
    const result = await build().getPortfolioPerformance(actor, "p1", {
      kind: "preset",
      period: "ALL",
    });

    expect(result.status).toBe("OK");
    expect(result.twr).toBeNull();
    expect(result.pnl?.isZero()).toBe(true);
    expect(result.series).toEqual([]);
  });

  it("raises NotFoundError for a portfolio the actor does not own", async () => {
    await expect(
      build({ owned: false }).getPortfolioPerformance(actor, "p1", {
        kind: "preset",
        period: "1M",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs analytics:read", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "analytics:read")),
      ADMIN: new Set(PERMISSIONS),
    };

    await expect(
      build({ permissions: noRead }).getPortfolioPerformance(actor, "p1", {
        kind: "preset",
        period: "1M",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
