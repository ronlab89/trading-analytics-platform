import { describe, expect, it } from "vitest";
import { Money, TransactionType } from "@trading/domain";
import type { Asset, HistoricalPrice, Portfolio, Transaction } from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createRangeAttributionService } from "./range-attribution-service.js";

const actor: Actor = { userId: "u1", role: "USER" };
const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

// 2026-03-31 is the last closed UTC day.
const clock = fixedClock(new Date("2026-04-01T12:00:00Z"));

const assets = new Map<string, Asset>([
  ["a1", { id: "a1", symbol: "AAA", name: "Asset A", assetType: "STOCK" } as Asset],
  ["b1", { id: "b1", symbol: "BBB", name: "Asset B", assetType: "CRYPTO" } as Asset],
]);

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function buy(assetId: string, executedAt: string, quantity: number, price: string): Transaction {
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
  return createRangeAttributionService({
    portfolioService: {
      getPortfolioById: () =>
        owned
          ? Promise.resolve(portfolio)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    assetService: {
      getAssetsByIds: (_actor, ids) =>
        Promise.resolve(new Map([...assets].filter(([id]) => ids.includes(id)))),
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

// A: one unit at 100, closing 100, 110, 120, 130. B: two units at 10, closing 10, 9, 8, 7.
const held = {
  transactions: [buy("a1", "2026-03-28", 1, "100"), buy("b1", "2026-03-28", 2, "10")],
  prices: [
    candle("a1", "2026-03-28", 100),
    candle("a1", "2026-03-29", 110),
    candle("a1", "2026-03-30", 120),
    candle("a1", "2026-03-31", 130),
    candle("b1", "2026-03-28", 10),
    candle("b1", "2026-03-29", 9),
    candle("b1", "2026-03-30", 8),
    candle("b1", "2026-03-31", 7),
  ],
};
const range = { kind: "custom", from: day("2026-03-29"), to: day("2026-03-31") } as const;

function summary(groups: readonly { key: string; label: string; contribution: Money }[]) {
  return groups.map((group) => [group.key, group.label, group.contribution.toString()]);
}

describe("range attribution service", () => {
  it("attributes the period P/L to each asset, labelled by symbol", async () => {
    // Baseline 2026-03-28: V_A = 100, V_B = 20. A gains 30 and B loses 6.
    const result = await build(held).getRangeAttribution(actor, "p1", range, "asset");

    expect(result.status).toBe("OK");
    expect(result.groupBy).toBe("asset");
    expect(result.asOf).toEqual(day("2026-03-31"));
    expect(result.effectiveFrom).toEqual(day("2026-03-29"));
    expect(result.pnl?.toString()).toBe("24");
    expect(summary(result.groups)).toEqual([
      ["a1", "AAA", "30"],
      ["b1", "BBB", "-6"],
    ]);
  });

  it("groups the contributions by asset type", async () => {
    const result = await build(held).getRangeAttribution(actor, "p1", range, "assetType");

    expect(summary(result.groups)).toEqual([
      ["CRYPTO", "CRYPTO", "-6"],
      ["STOCK", "STOCK", "30"],
    ]);
    expect(result.pnl?.toString()).toBe("24");
  });

  it("clamps a `to` after the last closed day and reports it as `asOf`", async () => {
    const result = await build(held).getRangeAttribution(
      actor,
      "p1",
      { kind: "custom", from: day("2026-03-29"), to: day("2026-04-10") },
      "asset",
    );

    expect(result.asOf).toEqual(day("2026-03-31"));
    expect(result.pnl?.toString()).toBe("24");
  });

  it("is INSUFFICIENT_DATA, with no groups, when the last day has no price", async () => {
    const result = await build({
      ...held,
      prices: held.prices.filter((price) => price.assetId === "a1"),
    }).getRangeAttribution(actor, "p1", range, "asset");

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      effectiveFrom: null,
      pnl: null,
      groups: [],
    });
  });

  it("is INSUFFICIENT_DATA when `from` is after the last closed day", async () => {
    const result = await build(held).getRangeAttribution(
      actor,
      "p1",
      { kind: "custom", from: day("2026-04-05") },
      "asset",
    );

    expect(result).toMatchObject({ status: "INSUFFICIENT_DATA", pnl: null, groups: [] });
  });

  it("returns a zero P/L and no groups for a portfolio without transactions", async () => {
    const result = await build().getRangeAttribution(
      actor,
      "p1",
      { kind: "preset", period: "ALL" },
      "asset",
    );

    expect(result).toMatchObject({ status: "OK", effectiveFrom: null, groups: [] });
    expect(result.pnl?.isZero()).toBe(true);
  });

  it("raises NotFoundError for a portfolio the actor does not own", async () => {
    await expect(
      build({ owned: false }).getRangeAttribution(actor, "p1", range, "asset"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs analytics:read", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "analytics:read")),
      ADMIN: new Set(PERMISSIONS),
    };

    await expect(
      build({ permissions: noRead }).getRangeAttribution(actor, "p1", range, "asset"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
