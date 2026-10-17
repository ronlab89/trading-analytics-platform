import { describe, expect, it, vi } from "vitest";
import { Money, TransactionStatus, TransactionType } from "@trading/domain";
import type {
  Asset,
  HistoricalPrice,
  MarketPrice,
  Portfolio,
  Position,
  Transaction,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { fixedClock } from "./clock.js";
import { ForbiddenError, NotFoundError } from "./errors.js";
import { createOverviewService } from "./overview-service.js";
import { PERMISSIONS, type RolePermissions } from "./permissions.js";

const actor: Actor = { userId: "u1", role: "USER" };
const now = new Date("2026-09-20T12:00:00Z");

const portfolio = { id: "p1", userId: "u1", baseCurrency: "USD" } as Portfolio;

const asset: Asset = {
  id: "a1",
  symbol: "AAA",
  name: "Asset A",
  assetType: "STOCK",
  currency: "USD",
  exchange: "MOCK",
  status: "ACTIVE",
  metadata: {},
};

const position: Position = {
  id: "x1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 2,
  averageEntryPrice: Money.of("100", "USD"),
  currentPrice: Money.of("150", "USD"),
  openedAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

const transaction: Transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: TransactionType.BUY,
  quantity: 2,
  price: Money.of("100", "USD"),
  fees: Money.of("0", "USD"),
  status: TransactionStatus.COMPLETED,
  executedAt: new Date("2026-01-01T00:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const marketPrice: MarketPrice = {
  assetId: "a1",
  price: Money.of("150", "USD"),
  previousPrice: Money.of("140", "USD"),
  change: Money.of("10", "USD"),
  changePercent: 7.14,
  timestamp: now,
  source: "MOCK",
};

interface Options {
  positions?: Position[];
  transactions?: Transaction[];
  marketPrices?: MarketPrice[];
  candles?: HistoricalPrice[];
  owned?: boolean;
  permissions?: RolePermissions;
}

function build(options: Options = {}) {
  const {
    positions = [position],
    transactions = [transaction],
    marketPrices = [marketPrice],
    candles = [],
    owned = true,
    permissions,
  } = options;

  const listTransactions = vi.fn(() =>
    Promise.resolve({ items: transactions, total: transactions.length }),
  );
  const listSeriesCandles = vi.fn((_assetIds: readonly string[], _from: Date, _to: Date) =>
    Promise.resolve(candles),
  );

  const service = createOverviewService({
    positionRepository: { listByPortfolioId: () => Promise.resolve(positions) },
    transactionRepository: {
      listByPortfolioId: listTransactions,
      listCompletedByPortfolioId: () => Promise.resolve(transactions),
    },
    marketPriceRepository: { listByAssetIds: () => Promise.resolve(marketPrices) },
    historicalPriceRepository: { listByAssetIds: listSeriesCandles },
    portfolioService: {
      getPortfolioById: () =>
        owned
          ? Promise.resolve(portfolio)
          : Promise.reject(new NotFoundError("The requested resource could not be found.")),
    },
    assetService: {
      getAssetsByIds: (_actor, ids) =>
        Promise.resolve(new Map(ids.includes("a1") ? [["a1", asset]] : [])),
    },
    clock: fixedClock(now),
    ...(permissions ? { permissions } : {}),
  });

  return { service, listTransactions, listSeriesCandles };
}

describe("overview service", () => {
  it("returns a zeroed, non-null daily change for an empty portfolio", async () => {
    const { service } = build({ positions: [], transactions: [], marketPrices: [] });
    const overview = await service.getPortfolioOverview(actor, "p1");
    expect(overview.positions).toEqual([]);
    expect(overview.recentTransactions).toEqual([]);
    expect(overview.dailyChange?.changePercent).toBe(0);
    expect(overview.pulse).toBeDefined();
  });

  it("serves the 1M performance of the portfolio value series", async () => {
    // Bought 2026-01-01 (2 units at 100); the last closed day is 2026-09-19, so 1M starts 2026-08-20.
    const candles = [
      { assetId: "a1", timestamp: new Date("2026-08-19T00:00:00Z"), close: Money.of("100", "USD") },
      { assetId: "a1", timestamp: new Date("2026-09-19T00:00:00Z"), close: Money.of("150", "USD") },
    ] as HistoricalPrice[];

    const { service } = build({ candles });
    const { performance } = await service.getPortfolioOverview(actor, "p1");

    expect(performance.status).toBe("OK");
    expect(performance.asOf).toEqual(new Date("2026-09-19T00:00:00Z"));
    expect(performance.effectiveFrom).toEqual(new Date("2026-08-20T00:00:00Z"));
    // V goes from 2 x 100 to 2 x 150 on the last day, with no flows: P/L = 100.
    expect(performance.pnl?.equals(Money.of("100", "USD"))).toBe(true);
    expect(performance.twr?.toFixed(6)).toBe("0.500000");
    expect(performance.series.at(-1)?.date).toEqual(new Date("2026-09-19T00:00:00Z"));
  });

  it("reports an empty performance for an empty portfolio", async () => {
    const { service } = build({ positions: [], transactions: [], marketPrices: [] });
    const { performance } = await service.getPortfolioOverview(actor, "p1");

    expect(performance.status).toBe("OK");
    expect(performance.twr).toBeNull();
    expect(performance.pnl?.isZero()).toBe(true);
    expect(performance.series).toEqual([]);
  });

  it("enriches each position with its asset summary, allocation and daily change", async () => {
    const { service } = build();
    const overview = await service.getPortfolioOverview(actor, "p1");
    const [item] = overview.positions;
    expect(item?.asset).toEqual({ id: "a1", symbol: "AAA", name: "Asset A", assetType: "STOCK" });
    expect(item?.allocationPercent).toBe(100);
    expect(item?.dailyChange?.changeValue.equals(Money.of("20", "USD"))).toBe(true);
    expect(item?.dailyChange?.changePercent).toBe(7.14);
  });

  it("leaves a position's daily change null when it has no market price", async () => {
    const { service } = build({ marketPrices: [] });
    const overview = await service.getPortfolioOverview(actor, "p1");
    expect(overview.positions[0]?.dailyChange).toBeNull();
  });

  it("returns a null portfolio daily change when no held position has a market price", async () => {
    const { service } = build({ marketPrices: [] });
    const overview = await service.getPortfolioOverview(actor, "p1");
    expect(overview.dailyChange).toBeNull();
  });

  it("asks for the five most recent transactions and summarizes their asset", async () => {
    const { service, listTransactions } = build();
    const overview = await service.getPortfolioOverview(actor, "p1");
    expect(listTransactions).toHaveBeenCalledWith("p1", {}, { page: 1, pageSize: 5 });
    expect(overview.recentTransactions[0]?.asset?.symbol).toBe("AAA");
  });

  it("gives each recent SELL the P/L it realized and a BUY none", async () => {
    const sale: Transaction = {
      ...transaction,
      id: "t2",
      type: TransactionType.SELL,
      quantity: 1,
      price: Money.of("130", "USD"),
      executedAt: new Date("2026-02-01T00:00:00Z"),
    };
    const { service } = build({ transactions: [transaction, sale] });
    const overview = await service.getPortfolioOverview(actor, "p1");

    // Bought 2 at 100; sold 1 at 130.
    expect(
      overview.recentTransactions.map((entry) => entry.realizedPnL?.toString() ?? null),
    ).toEqual([null, "30"]);
  });

  it("reads historical prices up to the day after the last closed day, never the system time", async () => {
    const { service, listSeriesCandles } = build();
    await service.getPortfolioOverview(actor, "p1");
    // One read for the 1M performance and one for the 1Y pulse inputs.
    expect(listSeriesCandles).toHaveBeenCalledTimes(2);
    for (const call of listSeriesCandles.mock.calls) {
      expect(call[2]).toEqual(new Date("2026-09-20T00:00:00Z"));
    }
  });

  it("classifies the pulse volatility and drawdown from the portfolio series over 1Y", async () => {
    // Held from 2026-01-01; the close alternates 100 and 105 every day up to the last closed day.
    const candles = Array.from({ length: 262 }, (_, day) => ({
      assetId: "a1",
      timestamp: new Date(Date.UTC(2026, 0, 1 + day)),
      close: Money.of(day % 2 === 0 ? "100" : "105", "USD"),
    })) as HistoricalPrice[];

    const { service } = build({ candles });
    const { pulse } = await service.getPortfolioOverview(actor, "p1");

    // Returns of +5% and -4.76% a day: sigma ~ 4.9%, annualized with sqrt(365) about 93%.
    expect(pulse.volatility.classification).toBe("HIGH");
    expect(pulse.volatility.value).toBeGreaterThan(90);
    expect(pulse.volatility.value).toBeLessThan(97);
    // The deepest fall is 100 / 105 - 1 = -4.76%.
    expect(pulse.drawdown.classification).toBe("LOW");
    expect(pulse.drawdown.value).toBeCloseTo(-4.7619, 3);
  });

  it("leaves the pulse volatility UNKNOWN under 20 returns but keeps the drawdown", async () => {
    // Held since 2026-01-01 but priced only over the last 10 closed days.
    const candles = Array.from({ length: 10 }, (_, day) => ({
      assetId: "a1",
      timestamp: new Date(Date.UTC(2026, 8, 10 + day)),
      close: Money.of(day % 2 === 0 ? "100" : "85", "USD"),
    })) as HistoricalPrice[];

    const { service } = build({ candles });
    const { pulse } = await service.getPortfolioOverview(actor, "p1");

    expect(pulse.volatility.classification).toBe("UNKNOWN");
    expect(pulse.volatility.value).toBeNull();
    expect(pulse.drawdown.classification).toBe("MODERATE");
    expect(pulse.drawdown.value).toBeCloseTo(-15, 5);
  });

  describe("what changed", () => {
    // The last closed day is 2026-09-19, so the 1M period starts on 2026-08-20.
    const closes = (entries: [string, number][]) =>
      entries.map(([date, close]) => ({
        assetId: "a1",
        timestamp: new Date(`${date}T00:00:00Z`),
        close: Money.of(close, "USD"),
      })) as HistoricalPrice[];
    const trade = (
      type: TransactionType,
      executedAt: string,
      quantity: number,
      price: string,
    ): Transaction => ({
      ...transaction,
      id: `t-${type}-${executedAt}`,
      type,
      quantity,
      price: Money.of(price, "USD"),
      executedAt: new Date(`${executedAt}T00:00:00Z`),
    });

    it("names the largest contributor of the period and the days it covers", async () => {
      // Held since 2026-01-01 (2 units); the close goes from 100 to 150: a gain of 100.
      const { service } = build({
        candles: closes([
          ["2026-08-19", 100],
          ["2026-09-19", 150],
        ]),
      });
      const { whatChanged } = await service.getPortfolioOverview(actor, "p1");

      expect(whatChanged.status).toBe("OK");
      expect(whatChanged.asOf).toEqual(new Date("2026-09-19T00:00:00Z"));
      expect(whatChanged.effectiveFrom).toEqual(new Date("2026-08-20T00:00:00Z"));
      expect(whatChanged.contributor?.symbol).toBe("AAA");
      expect(whatChanged.contributor?.contribution.toString()).toBe("100");
      expect(whatChanged.detractor).toBeNull();
      // Already held on the baseline: it did not open in the period.
      expect(whatChanged.events).toEqual([]);
    });

    it("reports a position opened inside the period", async () => {
      const { service } = build({
        transactions: [trade(TransactionType.BUY, "2026-09-05", 2, "100")],
        candles: closes([
          ["2026-09-05", 100],
          ["2026-09-19", 150],
        ]),
      });
      const { whatChanged } = await service.getPortfolioOverview(actor, "p1");

      expect(whatChanged.events).toEqual([
        {
          type: "POSITION_OPENED",
          date: new Date("2026-09-05T00:00:00Z"),
          assetId: "a1",
          symbol: "AAA",
        },
      ]);
      // 300 at the end, none before, 200 paid: a gain of 100.
      expect(whatChanged.contributor?.contribution.toString()).toBe("100");
    });

    it("reports both events of a position closed and its symbol, though it is no longer held", async () => {
      const { service } = build({
        positions: [],
        transactions: [
          trade(TransactionType.BUY, "2026-08-25", 2, "100"),
          trade(TransactionType.SELL, "2026-09-10", 2, "110"),
        ],
        candles: closes([
          ["2026-08-25", 100],
          ["2026-09-10", 110],
        ]),
      });
      const { whatChanged } = await service.getPortfolioOverview(actor, "p1");

      expect(whatChanged.events.map((event) => [event.type, event.symbol])).toEqual([
        ["POSITION_OPENED", "AAA"],
        ["POSITION_CLOSED", "AAA"],
      ]);
      // Bought 2 at 100 and sold 2 at 110, with nothing left: a gain of 20.
      expect(whatChanged.contributor?.contribution.toString()).toBe("20");
    });

    it("has neither contributor nor events, without inventing a number, when the last day has no price", async () => {
      const { service } = build({ candles: [] });
      const { whatChanged } = await service.getPortfolioOverview(actor, "p1");

      expect(whatChanged).toMatchObject({
        status: "INSUFFICIENT_DATA",
        effectiveFrom: null,
        contributor: null,
        detractor: null,
        events: [],
      });
    });

    it("is an empty, OK result for an empty portfolio", async () => {
      const { service } = build({ positions: [], transactions: [], marketPrices: [] });
      const { whatChanged } = await service.getPortfolioOverview(actor, "p1");

      expect(whatChanged).toMatchObject({
        status: "OK",
        effectiveFrom: null,
        contributor: null,
        detractor: null,
        events: [],
      });
    });
  });

  it("raises NotFoundError for a portfolio the actor does not own", async () => {
    const { service } = build({ owned: false });
    await expect(service.getPortfolioOverview(actor, "p1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs overview:read", async () => {
    const noRead: RolePermissions = {
      USER: new Set(PERMISSIONS.filter((p) => p !== "overview:read")),
      ADMIN: new Set(PERMISSIONS),
    };
    const { service } = build({ permissions: noRead });
    await expect(service.getPortfolioOverview(actor, "p1")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
