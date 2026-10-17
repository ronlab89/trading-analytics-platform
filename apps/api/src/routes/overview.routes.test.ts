import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { overviewResponseSchema } from "@trading/contracts";
import type { OverviewResponse, PerformanceResponse } from "@trading/contracts";
import { createApp } from "../app.js";
import { body, type DataEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestMarketPrice,
  createTestPortfolio,
  createTestPosition,
  createTestUser,
} from "../test-utils/fixtures.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day `offset` days from today. The API runs on the system clock. */
function utcDay(offset: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offset * DAY_MS,
  );
}

/** Tests for the `performance` field of GET /api/v1/portfolios/:portfolioId/overview (B1.4 T4). */
describe("overview route: performance", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let portfolioId: string;
  let emptyPortfolioId: string;

  const auth = (): [string, string] => ["Authorization", `Bearer ${token}`];

  beforeAll(async () => {
    const owner = await createTestUser();
    userIds.push(owner.user.id);
    token = tokenFor(owner.user.id);

    const asset = await createTestAsset("OVPF");
    assetIds.push(asset.id);

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

    await createTestPosition(portfolioId, asset.id, {
      quantity: 1,
      averageEntryPrice: 100,
      currentPrice: 110,
    });

    // One unit bought 10 days ago at 100; it closes at 100, then 110 from the next day on.
    await prisma.transaction.create({
      data: {
        portfolioId,
        assetId: asset.id,
        type: "BUY",
        status: "COMPLETED",
        quantity: 1,
        price: 100,
        fees: 0,
        currency: "USD",
        executedAt: utcDay(-10),
      },
    });

    await prisma.historicalPrice.createMany({
      data: Array.from({ length: 10 }, (_, index) => {
        const close = index === 0 ? 100 : 110;
        return {
          assetId: asset.id,
          timestamp: utcDay(-10 + index),
          currency: "USD",
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        };
      }),
    });
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("carries the 1M performance, identical to the performance endpoint", async () => {
    const overview = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/overview`)
      .set(...auth());
    const performance = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/analytics/performance?period=1M`)
      .set(...auth());

    expect(overview.status).toBe(200);
    const data = body<DataEnvelope<OverviewResponse>>(overview).data;
    expect(overviewResponseSchema.safeParse(data).success).toBe(true);
    expect(data.performance).toEqual(body<DataEnvelope<PerformanceResponse>>(performance).data);
    expect(data.performance.status).toBe("OK");
    expect(Number(data.performance.pnl?.amount)).toBe(10);
  });

  it("carries an empty performance for an empty portfolio", async () => {
    const response = await request(app)
      .get(`/api/v1/portfolios/${emptyPortfolioId}/overview`)
      .set(...auth());

    expect(response.status).toBe(200);
    expect(body<DataEnvelope<OverviewResponse>>(response).data.performance).toMatchObject({
      status: "OK",
      effectiveFrom: null,
      twrPercent: null,
      pnl: { amount: "0", currency: "USD" },
      series: [],
    });
  });
});

/** Concrete `dailyChange` and `pulse` values of the overview (B1.5 T3). */
describe("overview route: dailyChange and pulse", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let steadyPortfolioId: string;
  let volatilePortfolioId: string;

  const auth = (): [string, string] => ["Authorization", `Bearer ${token}`];

  async function getOverview(portfolioId: string): Promise<OverviewResponse> {
    const response = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/overview`)
      .set(...auth());
    expect(response.status).toBe(200);
    return body<DataEnvelope<OverviewResponse>>(response).data;
  }

  async function seedHistory(
    portfolioId: string,
    assetId: string,
    closes: readonly number[],
  ): Promise<void> {
    // One unit bought on the first day, one candle per day ending yesterday.
    await prisma.transaction.create({
      data: {
        portfolioId,
        assetId,
        type: "BUY",
        status: "COMPLETED",
        quantity: 1,
        price: closes[0] ?? 100,
        fees: 0,
        currency: "USD",
        executedAt: utcDay(-closes.length),
      },
    });
    await prisma.historicalPrice.createMany({
      data: closes.map((close, index) => ({
        assetId,
        timestamp: utcDay(-closes.length + index),
        currency: "USD",
        open: close,
        high: close,
        low: close,
        close,
        volume: 1000,
      })),
    });
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    userIds.push(owner.user.id);
    token = tokenFor(owner.user.id);

    // Steady: +10% unrealized, a quote up 5 on 105, 9 returns (too few for volatility), no decline.
    const steadyAsset = await createTestAsset("PLSE");
    assetIds.push(steadyAsset.id);
    steadyPortfolioId = (await createTestPortfolio(owner.user.id)).id;
    await createTestPosition(steadyPortfolioId, steadyAsset.id, {
      quantity: 1,
      averageEntryPrice: 100,
      currentPrice: 110,
    });
    await createTestMarketPrice(steadyAsset.id, { price: 110, previousPrice: 105 });
    await seedHistory(steadyPortfolioId, steadyAsset.id, [100, ...Array<number>(9).fill(110)]);

    // Volatile: no quote, 30 days of closes alternating 100 and 105.
    const volatileAsset = await createTestAsset("PLVO");
    assetIds.push(volatileAsset.id);
    volatilePortfolioId = (await createTestPortfolio(owner.user.id, { name: "Volatile" })).id;
    await createTestPosition(volatilePortfolioId, volatileAsset.id, {
      quantity: 1,
      averageEntryPrice: 100,
      currentPrice: 100,
    });
    await seedHistory(
      volatilePortfolioId,
      volatileAsset.id,
      Array.from({ length: 30 }, (_, index) => (index % 2 === 0 ? 100 : 105)),
    );
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("reports the daily change from the latest quote", async () => {
    const { dailyChange } = await getOverview(steadyPortfolioId);

    expect(Number(dailyChange?.changeValue.amount)).toBe(5);
    expect(dailyChange?.changeValue.currency).toBe("USD");
    expect(dailyChange?.changePercent).toBeCloseTo(4.7619, 3);
    expect(dailyChange?.excludedAssetIds).toEqual([]);
  });

  it("classifies performance and concentration from the positions", async () => {
    const { pulse } = await getOverview(steadyPortfolioId);

    expect(pulse.performance).toMatchObject({ classification: "POSITIVE", value: 10 });
    expect(pulse.concentration).toMatchObject({ classification: "HIGH", value: 100 });
  });

  it("leaves the volatility UNKNOWN under 20 returns and classifies the drawdown", async () => {
    const { pulse } = await getOverview(steadyPortfolioId);

    expect(pulse.volatility).toMatchObject({ classification: "UNKNOWN", value: null });
    expect(pulse.drawdown).toMatchObject({ classification: "LOW", value: 0 });
  });

  it("classifies the annualized volatility and the drawdown of the portfolio series", async () => {
    const { pulse } = await getOverview(volatilePortfolioId);

    // Returns of +5% and -4.76% a day: sigma ~ 4.9%, annualized with sqrt(365) about 93%.
    expect(pulse.volatility.classification).toBe("HIGH");
    expect(pulse.volatility.value).toBeGreaterThan(90);
    expect(pulse.volatility.value).toBeLessThan(97);
    expect(pulse.drawdown.classification).toBe("LOW");
    expect(pulse.drawdown.value).toBeCloseTo(-4.7619, 3);
  });

  it("returns a null daily change when no held asset has a quote", async () => {
    const { dailyChange } = await getOverview(volatilePortfolioId);

    expect(dailyChange).toBeNull();
  });
});
