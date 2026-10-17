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
  const listCandles = vi.fn((_assetId: string, _from: Date, _to: Date) => Promise.resolve([]));
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
    historicalPriceRepository: { listByAssetId: listCandles, listByAssetIds: listSeriesCandles },
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

  return { service, listTransactions, listCandles };
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

  it("reads historical prices up to the clock's now, never the system time", async () => {
    const { service, listCandles } = build();
    await service.getPortfolioOverview(actor, "p1");
    expect(listCandles).toHaveBeenCalledTimes(1);
    expect(listCandles.mock.calls[0]?.[2]).toEqual(now);
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
