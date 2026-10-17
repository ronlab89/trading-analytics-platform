import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { rangeAttributionResponseSchema } from "@trading/contracts";
import type { RangeAttributionResponse } from "@trading/contracts";
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

/** Tests for the range form of GET /api/v1/portfolios/:portfolioId/analytics/attribution (B1.5 T4). */
describe("range attribution route", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;
  let portfolioId: string;
  let emptyPortfolioId: string;
  let stock: { id: string; symbol: string };
  let crypto: { id: string; symbol: string };

  const auth = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
  const attributionUrl = (id: string): string => `/api/v1/portfolios/${id}/analytics/attribution`;

  async function getRange(
    query: string,
    id = portfolioId,
  ): Promise<{ status: number; data: RangeAttributionResponse }> {
    const response = await request(app)
      .get(`${attributionUrl(id)}${query}`)
      .set(...auth(ownerToken));
    return {
      status: response.status,
      data: body<DataEnvelope<RangeAttributionResponse>>(response).data,
    };
  }

  async function seed(
    assetId: string,
    quantity: number,
    price: number,
    closeAfterFirstDay: number,
  ): Promise<void> {
    // Bought 10 days ago; it closes at the purchase price, then at `closeAfterFirstDay`.
    await prisma.transaction.create({
      data: {
        portfolioId,
        assetId,
        type: "BUY",
        status: "COMPLETED",
        quantity,
        price,
        fees: 0,
        currency: "USD",
        executedAt: utcDay(-10),
      },
    });
    await prisma.historicalPrice.createMany({
      data: Array.from({ length: 10 }, (_, index) => {
        const close = index === 0 ? price : closeAfterFirstDay;
        return {
          assetId,
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
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);

    const stockHandle = await createTestAsset("RASTK");
    const cryptoHandle = await createTestAsset("RACRY", { assetType: "CRYPTO" });
    assetIds.push(stockHandle.id, cryptoHandle.id);
    const [stockAsset, cryptoAsset] = await Promise.all([
      prisma.asset.findUniqueOrThrow({ where: { id: stockHandle.id } }),
      prisma.asset.findUniqueOrThrow({ where: { id: cryptoHandle.id } }),
    ]);
    stock = { id: stockAsset.id, symbol: stockAsset.symbol };
    crypto = { id: cryptoAsset.id, symbol: cryptoAsset.symbol };

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

    // From the day of the purchase, the stock goes 100 -> 110 and the crypto 20 -> 16.
    await seed(stock.id, 1, 100, 110);
    await seed(crypto.id, 2, 10, 8);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("rejects a request without a token with 401", async () => {
    const response = await request(app).get(`${attributionUrl(portfolioId)}?groupBy=asset`);

    expect(response.status).toBe(401);
  });

  it("returns 404 for a portfolio the user does not own", async () => {
    const response = await request(app)
      .get(`${attributionUrl(portfolioId)}?groupBy=asset`)
      .set(...auth(otherToken));

    expect(response.status).toBe(404);
  });

  it("splits the P/L of a custom range by asset, in money", async () => {
    const { status, data } = await getRange(`?from=${isoDay(-9)}&to=${isoDay(-1)}`);

    expect(status).toBe(200);
    expect(rangeAttributionResponseSchema.parse(data)).toEqual(data);
    expect(data).toMatchObject({
      status: "OK",
      groupBy: "asset",
      asOf: isoDay(-1),
      effectiveFrom: isoDay(-9),
      pnl: { amount: "6", currency: "USD" },
    });
    expect(data.groups).toHaveLength(2);
    expect(data.groups.find((group) => group.key === stock.id)).toEqual({
      key: stock.id,
      label: stock.symbol,
      contribution: { amount: "10", currency: "USD" },
    });
    expect(data.groups.find((group) => group.key === crypto.id)).toEqual({
      key: crypto.id,
      label: crypto.symbol,
      contribution: { amount: "-4", currency: "USD" },
    });
  });

  it("groups the contributions by asset type", async () => {
    const { status, data } = await getRange(
      `?from=${isoDay(-9)}&to=${isoDay(-1)}&groupBy=assetType`,
    );

    expect(status).toBe(200);
    expect(data.groupBy).toBe("assetType");
    expect(data.groups).toEqual([
      { key: "CRYPTO", label: "CRYPTO", contribution: { amount: "-4", currency: "USD" } },
      { key: "STOCK", label: "STOCK", contribution: { amount: "10", currency: "USD" } },
    ]);
  });

  it("serves a preset period, and the default 1M for `groupBy` alone", async () => {
    const preset = await getRange("?period=1W");
    const byGroup = await getRange("?groupBy=asset");

    expect(preset.status).toBe(200);
    expect(preset.data.pnl).toEqual({ amount: "0", currency: "USD" });
    expect(byGroup.status).toBe(200);
    expect(byGroup.data.asOf).toBe(isoDay(-1));
    // The month starts before the purchase, so the whole gain counts: 10 + (-4).
    expect(byGroup.data.pnl).toEqual({ amount: "6", currency: "USD" });
  });

  it("returns a zero P/L and no groups for an empty portfolio", async () => {
    const { status, data } = await getRange("?period=1M", emptyPortfolioId);

    expect(status).toBe(200);
    expect(data).toMatchObject({
      status: "OK",
      effectiveFrom: null,
      pnl: { amount: "0", currency: "USD" },
      groups: [],
    });
  });

  it.each([
    ["an unsupported groupBy", "?groupBy=currency"],
    ["period together with from", `?period=1M&from=${isoDay(-5)}`],
    ["from after to", `?from=${isoDay(-1)}&to=${isoDay(-2)}`],
    ["to without from", `?to=${isoDay(-1)}`],
    ["the 1D period", "?period=1D"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_name, query) => {
    const response = await request(app)
      .get(`${attributionUrl(portfolioId)}${query}`)
      .set(...auth(ownerToken));

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });
});
