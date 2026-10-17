import { describe, expect, it } from "vitest";
import { Money, TransactionType } from "@trading/domain";
import type { HistoricalPrice, Portfolio, Transaction } from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";
import { createRiskService } from "./risk-service.js";

const actor: Actor = { userId: "u1", role: "USER" };
const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

// 2026-03-31 is the last closed UTC day.
const clock = fixedClock(new Date("2026-04-01T12:00:00Z"));

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function buy(assetId: string, executedAt: string, quantity = 1): Transaction {
  return {
    id: `t-${assetId}-${executedAt}`,
    portfolioId: "p1",
    assetId,
    type: TransactionType.BUY,
    quantity,
    price: Money.of("100", "USD"),
    fees: Money.zero("USD"),
    status: "COMPLETED",
    executedAt: day(executedAt),
  } as Transaction;
}

function candle(assetId: string, date: Date, close: number): HistoricalPrice {
  return { assetId, timestamp: date, close: Money.of(close, "USD") } as HistoricalPrice;
}

/** One candle per day from `from`, `count` days long, each close moving by `rates[i % rates.length]`. */
function candles(assetId: string, from: string, count: number, rates: readonly number[]) {
  const result: HistoricalPrice[] = [];
  let close = 100;
  for (let i = 0; i < count; i++) {
    close *= 1 + (rates[i % rates.length] ?? 0);
    result.push(candle(assetId, new Date(day(from).getTime() + i * 86_400_000), close));
  }
  return result;
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
  return createRiskService({
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

// A held asset priced every day from 2026-02-28 (the baseline of March) to 2026-03-31.
const heldAndPriced = {
  transactions: [buy("a1", "2026-02-28")],
  prices: candles("a1", "2026-02-28", 32, [0.01, -0.01]),
};

describe("risk service", () => {
  it("measures volatility and drawdown over the period with 20 or more returns", async () => {
    const risk = await build(heldAndPriced).getPortfolioRisk(actor, "p1", {
      kind: "preset",
      period: "1M",
    });

    expect(risk.status).toBe("OK");
    expect(risk.asOf).toEqual(day("2026-03-31"));
    expect(risk.effectiveFrom).toEqual(day("2026-03-01"));
    expect(risk.volatility.status).toBe("OK");
    expect(risk.volatility.sampleSize).toBe(31);
    expect(risk.drawdown.status).toBe("OK");
    expect(risk.drawdown.maxDrawdown?.isNegative()).toBe(true);
  });

  it("leaves the volatility unknown under 20 returns but keeps the drawdown", async () => {
    const risk = await build(heldAndPriced).getPortfolioRisk(actor, "p1", {
      kind: "preset",
      period: "1W",
    });

    expect(risk.status).toBe("OK");
    expect(risk.volatility).toEqual({ status: "UNKNOWN", volatilityPercent: null, sampleSize: 7 });
    expect(risk.drawdown.status).toBe("OK");
  });

  it("reports a zero drawdown on a rising index", async () => {
    const risk = await build({
      transactions: [buy("a1", "2026-02-28")],
      prices: candles("a1", "2026-02-28", 32, [0.01]),
    }).getPortfolioRisk(actor, "p1", { kind: "preset", period: "1W" });

    expect(risk.drawdown.maxDrawdown?.isZero()).toBe(true);
    expect(risk.drawdown.peakDate).toBeNull();
  });

  it("clamps a `to` after the last closed day and ignores later trades", async () => {
    const query = { kind: "custom", from: day("2026-03-25"), to: day("2026-04-02") } as const;

    const without = await build(heldAndPriced).getPortfolioRisk(actor, "p1", query);
    const withLater = await build({
      transactions: [...heldAndPriced.transactions, buy("a2", "2026-04-01")],
      prices: heldAndPriced.prices,
    }).getPortfolioRisk(actor, "p1", query);

    expect(without.asOf).toEqual(day("2026-03-31"));
    expect(withLater).toEqual(without);
  });

  it("is INSUFFICIENT_DATA when `from` is after the last closed day", async () => {
    const risk = await build(heldAndPriced).getPortfolioRisk(actor, "p1", {
      kind: "custom",
      from: day("2026-04-01"),
    });

    expect(risk.status).toBe("INSUFFICIENT_DATA");
    expect(risk.asOf).toEqual(day("2026-03-31"));
    expect(risk.effectiveFrom).toBeNull();
    expect(risk.volatility.volatilityPercent).toBeNull();
    expect(risk.drawdown.maxDrawdown).toBeNull();
  });

  it("is INSUFFICIENT_DATA when a held asset has no price on the last day", async () => {
    const risk = await build({
      transactions: [buy("a1", "2026-02-28")],
      prices: [],
    }).getPortfolioRisk(actor, "p1", { kind: "preset", period: "1M" });

    expect(risk.status).toBe("INSUFFICIENT_DATA");
    expect(risk.drawdown.maxDrawdown).toBeNull();
  });

  it("is UNKNOWN for a portfolio without transactions", async () => {
    const risk = await build().getPortfolioRisk(actor, "p1", { kind: "preset", period: "1M" });

    expect(risk.status).toBe("UNKNOWN");
    expect(risk.effectiveFrom).toBeNull();
  });

  it("is UNKNOWN for ALL when there is no transaction to start from", async () => {
    const risk = await build().getPortfolioRisk(actor, "p1", { kind: "preset", period: "ALL" });

    expect(risk.status).toBe("UNKNOWN");
    expect(risk.asOf).toEqual(day("2026-03-31"));
  });

  it("raises NotFoundError for a portfolio the actor does not own", async () => {
    await expect(
      build({ owned: false }).getPortfolioRisk(actor, "p1", { kind: "preset", period: "1M" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs analytics:read", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "analytics:read")),
      ADMIN: new Set(PERMISSIONS),
    };

    await expect(
      build({ permissions: noRead }).getPortfolioRisk(actor, "p1", {
        kind: "preset",
        period: "1M",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
