import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { performanceResponseSchema } from "@trading/contracts";
import type { PerformanceResponse } from "@trading/contracts";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
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

function isoDay(offset: number): string {
  return utcDay(offset).toISOString().slice(0, 10);
}

/** Tests for GET /api/v1/portfolios/:portfolioId/analytics/performance (B1.4 T3b). */
describe("performance route", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;
  let portfolioId: string;
  let emptyPortfolioId: string;

  const auth = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
  const performanceUrl = (id: string): string => `/api/v1/portfolios/${id}/analytics/performance`;

  async function getPerformance(
    query = "",
  ): Promise<{ status: number; data: PerformanceResponse }> {
    const response = await request(app)
      .get(`${performanceUrl(portfolioId)}${query}`)
      .set(...auth(ownerToken));
    return {
      status: response.status,
      data: body<DataEnvelope<PerformanceResponse>>(response).data,
    };
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);

    const asset = await createTestAsset("PERF");
    assetIds.push(asset.id);

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

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

  it("rejects a request without a token with 401", async () => {
    const response = await request(app).get(performanceUrl(portfolioId));

    expect(response.status).toBe(401);
  });

  it("returns 404 for a portfolio the user does not own", async () => {
    const response = await request(app)
      .get(performanceUrl(portfolioId))
      .set(...auth(otherToken));

    expect(response.status).toBe(404);
  });

  it("measures the TWR and the P/L of a custom range, with one point per day", async () => {
    const { status, data } = await getPerformance(`?from=${isoDay(-9)}&to=${isoDay(-1)}`);

    expect(status).toBe(200);
    expect(performanceResponseSchema.parse(data)).toEqual(data);
    expect(data.status).toBe("OK");
    expect(data.asOf).toBe(isoDay(-1));
    expect(data.effectiveFrom).toBe(isoDay(-9));
    // +10% on the first day, then flat.
    expect(data.twrPercent).toBeCloseTo(10, 10);
    expect(data.pnl?.currency).toBe("USD");
    expect(Number(data.pnl?.amount)).toBe(10);
    expect(data.series).toHaveLength(9);
    expect(data.series[0]?.date).toBe(isoDay(-9));
    expect(data.series[0]?.returnPercent).toBeCloseTo(10, 10);
    expect(data.series[1]?.returnPercent).toBe(0);
  });

  it("serves the default 1M period, valuing the days before the first purchase at zero", async () => {
    const { status, data } = await getPerformance();

    expect(status).toBe(200);
    expect(data.status).toBe("OK");
    expect(data.asOf).toBe(isoDay(-1));
    expect(data.series.length).toBeGreaterThan(9);
    expect(data.series[0]?.value?.amount).toBe("0");
    expect(data.series[0]?.returnPercent).toBeNull();
  });

  it("clamps a `to` after the last closed day and reports asOf", async () => {
    const { status, data } = await getPerformance(`?from=${isoDay(-5)}&to=${isoDay(5)}`);

    expect(status).toBe(200);
    expect(data.asOf).toBe(isoDay(-1));
    expect(data.series.at(-1)?.date).toBe(isoDay(-1));
  });

  it("returns 200 INSUFFICIENT_DATA with nulls when `from` is after the last closed day", async () => {
    const { status, data } = await getPerformance(`?from=${isoDay(0)}`);

    expect(status).toBe(200);
    expect(data).toEqual({
      asOf: isoDay(-1),
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      twrPercent: null,
      pnl: null,
      series: [],
    });
  });

  it("returns a zero P/L and no TWR for a portfolio without transactions", async () => {
    const response = await request(app)
      .get(performanceUrl(emptyPortfolioId))
      .set(...auth(ownerToken));

    expect(response.status).toBe(200);
    expect(body<DataEnvelope<PerformanceResponse>>(response).data).toMatchObject({
      status: "OK",
      effectiveFrom: null,
      twrPercent: null,
      pnl: { amount: "0", currency: "USD" },
      series: [],
    });
  });

  it.each([
    ["period together with from", `?period=1M&from=${isoDay(-5)}`],
    ["from after to", `?from=${isoDay(-1)}&to=${isoDay(-2)}`],
    ["to without from", `?to=${isoDay(-1)}`],
    ["the 1D period", "?period=1D"],
    ["a date that is not a calendar date", "?from=2026-02-30"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_name, query) => {
    const response = await request(app)
      .get(`${performanceUrl(portfolioId)}${query}`)
      .set(...auth(ownerToken));

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });
});
