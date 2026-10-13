import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type {
  Portfolio,
  PortfolioDailyChange,
  PortfolioMetrics,
  PortfolioPulse,
  Position,
  PositionMetrics,
  Transaction,
} from "@trading/domain";
import {
  overviewResponseSchema,
  presentOverview,
  type OverviewSource,
} from "./overview.response.js";

const usd = (amount: string): Money => Money.of(amount, "USD");

const portfolio: Portfolio = {
  id: "p1",
  userId: "u1",
  name: "Main",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
  updatedAt: new Date("2026-10-13T12:00:00.000Z"),
};

const position: Position = {
  id: "pos1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 10,
  averageEntryPrice: usd("100"),
  currentPrice: usd("150"),
  openedAt: new Date("2026-10-01T12:00:00.000Z"),
  updatedAt: new Date("2026-10-13T12:00:00.000Z"),
};

const metrics: PositionMetrics = {
  marketValue: usd("1500"),
  costBasis: usd("1000"),
  unrealizedPnL: usd("500"),
  unrealizedPnLPercent: 50,
};

const summary: PortfolioMetrics = {
  totalValue: usd("1500"),
  investedValue: usd("1000"),
  unrealizedPnL: usd("500"),
  unrealizedPnLPercent: 50,
};

const transaction: Transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 10,
  price: usd("100"),
  fees: usd("1"),
  status: "COMPLETED",
  executedAt: new Date("2026-10-01T12:00:00.000Z"),
  createdAt: new Date("2026-10-01T12:00:01.000Z"),
};

const dailyChange: PortfolioDailyChange = {
  changeValue: usd("25.5"),
  changePercent: 1.7,
  excludedAssetIds: ["a9"],
};

const pulse: PortfolioPulse = {
  performance: { classification: "POSITIVE", value: 50, explanation: "x" },
  concentration: { classification: "HIGH", value: 100, explanation: "x" },
  volatility: { classification: "UNKNOWN", value: null, explanation: "x" },
  drawdown: { classification: "UNKNOWN", value: null, explanation: "x" },
};

const assetSummary = { id: "a1", symbol: "BTC", name: "Bitcoin", assetType: "CRYPTO" } as const;

const overview: OverviewSource = {
  portfolio,
  summary,
  positions: [
    {
      position,
      asset: assetSummary,
      metrics,
      allocationPercent: 100,
      dailyChange: { changeValue: usd("25.5"), changePercent: 1.7 },
    },
    {
      position: { ...position, id: "pos2", assetId: "a2" },
      asset: null,
      metrics,
      allocationPercent: 0,
      dailyChange: null,
    },
  ],
  allocation: {
    groupBy: "asset",
    groups: [{ key: "a1", label: "BTC", marketValue: usd("1500"), percentage: 100 }],
  },
  attribution: {
    totalUnrealizedPnL: usd("500"),
    items: [
      {
        assetId: "a1",
        contribution: usd("500"),
        percentageOfTotal: 100,
        symbol: "BTC",
        name: "Bitcoin",
      },
    ],
  },
  recentTransactions: [{ transaction, asset: assetSummary }],
  dailyChange,
  pulse,
};

describe("overview presenter", () => {
  it("serializes the overview exactly as before", () => {
    const dto = presentOverview(overview);
    expect(dto).toEqual(JSON.parse(JSON.stringify(overview)));
    expect(overviewResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("keeps a null dailyChange and null per-position data", () => {
    const dto = presentOverview({ ...overview, dailyChange: null });
    expect(dto.dailyChange).toBeNull();
    expect(dto.positions[1]?.dailyChange).toBeNull();
    expect(dto.positions[1]?.asset).toBeNull();
    expect(overviewResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentOverview({ ...overview, extra: 1 } as OverviewSource);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "allocation",
        "attribution",
        "dailyChange",
        "portfolio",
        "positions",
        "pulse",
        "recentTransactions",
        "summary",
      ].sort(),
    );
  });
});
