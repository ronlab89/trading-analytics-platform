import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { riskResponseSchema } from "@trading/contracts";
import type { RiskResponse } from "@trading/contracts";
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

/** Tests for GET /api/v1/portfolios/:portfolioId/analytics/risk (B1.3 T4c). */
describe("risk route", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;
  let portfolioId: string;
  let emptyPortfolioId: string;

  const auth = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
  const riskUrl = (id: string): string => `/api/v1/portfolios/${id}/analytics/risk`;

  async function getRisk(query = ""): Promise<{ status: number; data: RiskResponse }> {
    const response = await request(app)
      .get(`${riskUrl(portfolioId)}${query}`)
      .set(...auth(ownerToken));
    return { status: response.status, data: body<DataEnvelope<RiskResponse>>(response).data };
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);

    const asset = await createTestAsset("RISK");
    assetIds.push(asset.id);

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

    // One unit bought 40 days ago, priced every day since with alternating +-1% moves.
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
        executedAt: utcDay(-40),
      },
    });

    let close = 100;
    await prisma.historicalPrice.createMany({
      data: Array.from({ length: 40 }, (_, index) => {
        close = Number((close * (index % 2 === 0 ? 1.01 : 0.99)).toFixed(4));
        return {
          assetId: asset.id,
          timestamp: utcDay(-40 + index),
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
    const response = await request(app).get(riskUrl(portfolioId));

    expect(response.status).toBe(401);
  });

  it("returns 404 for a portfolio the user does not own", async () => {
    const response = await request(app)
      .get(riskUrl(portfolioId))
      .set(...auth(otherToken));

    expect(response.status).toBe(404);
  });

  it("measures volatility and drawdown over the default 1M period", async () => {
    const { status, data } = await getRisk();

    expect(status).toBe(200);
    expect(riskResponseSchema.parse(data)).toEqual(data);
    expect(data.status).toBe("OK");
    expect(data.asOf).toBe(isoDay(-1));
    expect(data.volatilityPercent).toBeGreaterThan(0);
    expect(data.maxDrawdownPercent).toBeLessThan(0);
    expect(data.currentDrawdownPercent).not.toBeNull();
    expect(data.peakDate).not.toBeNull();
    expect(data.troughDate).not.toBeNull();
  });

  it("leaves the volatility null, not 0, under 20 returns", async () => {
    const { status, data } = await getRisk("?period=1W");

    expect(status).toBe(200);
    expect(data.status).toBe("OK");
    expect(data.volatilityPercent).toBeNull();
    expect(data.maxDrawdownPercent).not.toBeNull();
  });

  it("clamps a `to` after the last closed day and reports asOf", async () => {
    const { status, data } = await getRisk(`?from=${isoDay(-10)}&to=${isoDay(5)}`);

    expect(status).toBe(200);
    expect(data.asOf).toBe(isoDay(-1));
    expect(data.effectiveFrom).toBe(isoDay(-10));
  });

  it("returns 200 INSUFFICIENT_DATA with nulls when `from` is after the last closed day", async () => {
    const { status, data } = await getRisk(`?from=${isoDay(0)}`);

    expect(status).toBe(200);
    expect(data).toEqual({
      asOf: isoDay(-1),
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      volatilityPercent: null,
      maxDrawdownPercent: null,
      currentDrawdownPercent: null,
      peakDate: null,
      troughDate: null,
    });
  });

  it("returns 200 UNKNOWN for a portfolio without transactions", async () => {
    const response = await request(app)
      .get(riskUrl(emptyPortfolioId))
      .set(...auth(ownerToken));

    expect(response.status).toBe(200);
    expect(body<DataEnvelope<RiskResponse>>(response).data).toMatchObject({
      status: "UNKNOWN",
      effectiveFrom: null,
      volatilityPercent: null,
      maxDrawdownPercent: null,
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
      .get(`${riskUrl(portfolioId)}${query}`)
      .set(...auth(ownerToken));

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });
});
