import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

let client: TradingClient;
let portfolioId: string;

beforeEach(async () => {
  const clock = fixedClock(new Date("2026-01-31T12:00:00Z"));
  client = createDemoTradingClient({ composition: await createDemoComposition({ clock }) });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
});

const read = (operationId: string, query: Record<string, string> = {}, id = portfolioId) =>
  client.call(op(operationId), { params: { portfolioId: id }, query });

describe("analytics handlers", () => {
  it("answers the overview of the seeded portfolio with its positions and recent transactions", async () => {
    const answer = (await read("getPortfolioOverview")) as {
      data: { positions: unknown[]; recentTransactions: unknown[] };
    };

    expect(answer.data.positions).toHaveLength(3);
    expect(answer.data.recentTransactions).toHaveLength(3);
  });

  it("splits the allocation by asset, by type and by currency, each adding up to 100 %", async () => {
    for (const groupBy of ["asset", "assetType", "currency"]) {
      const answer = (await read("getPortfolioAllocation", { groupBy })) as {
        data: { groups: { percentage: number }[] };
      };
      const total = answer.data.groups.reduce((sum, group) => sum + group.percentage, 0);

      expect(answer.data.groups.length).toBeGreaterThan(0);
      expect(total).toBeCloseTo(100, 1);
    }
  });

  it("refuses an unknown grouping as 400 VALIDATION_ERROR", async () => {
    await expect(read("getPortfolioAllocation", { groupBy: "sector" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("answers the attribution as a snapshot and, with groupBy, over a period", async () => {
    await expect(read("getPortfolioAttribution")).resolves.toBeDefined();
    await expect(
      read("getPortfolioAttribution", { period: "1M", groupBy: "assetType" }),
    ).resolves.toBeDefined();
  });

  it("answers performance and risk for each preset period", async () => {
    for (const period of ["1W", "1M", "3M", "6M", "YTD", "1Y", "ALL"]) {
      await expect(read("getPortfolioPerformance", { period })).resolves.toBeDefined();
      await expect(read("getPortfolioRisk", { period })).resolves.toBeDefined();
    }
  });

  it("changes the performance series with the period", async () => {
    const week = (await read("getPortfolioPerformance", { period: "1W" })) as {
      data: { series: unknown[] };
    };
    const month = (await read("getPortfolioPerformance", { period: "1M" })) as {
      data: { series: unknown[] };
    };

    expect(month.data.series.length).toBeGreaterThan(week.data.series.length);
  });

  it("refuses a period together with a date range, and an unknown period", async () => {
    await expect(
      read("getPortfolioPerformance", { period: "1M", from: "2026-01-01" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(read("getPortfolioRisk", { period: "10Y" })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("answers 404 for a portfolio that does not exist", async () => {
    await expect(read("getPortfolioOverview", {}, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("answers an empty portfolio without failing", async () => {
    const created = (await client.call(op("createPortfolio"), {
      body: { name: "Empty", baseCurrency: "USD" },
    })) as { data: { id: string } };

    for (const operationId of [
      "getPortfolioOverview",
      "getPortfolioAllocation",
      "getPortfolioPerformance",
      "getPortfolioRisk",
    ]) {
      await expect(read(operationId, {}, created.data.id)).resolves.toBeDefined();
    }
  });
});
