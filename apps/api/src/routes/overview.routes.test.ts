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
