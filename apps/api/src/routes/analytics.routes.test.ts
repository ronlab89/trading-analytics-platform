import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
  createTestPosition,
  createTestUser,
} from "../test-utils/fixtures.js";

interface MoneyDto {
  amount: string;
  currency: string;
}

interface AllocationDto {
  groupBy: string;
  groups: { key: string; label: string; marketValue: MoneyDto; percentage: number }[];
}

interface AttributionDto {
  totalUnrealizedPnL: MoneyDto;
  items: {
    assetId: string;
    symbol: string;
    name: string;
    contribution: MoneyDto;
    percentageOfTotal: number;
  }[];
}

/**
 * Characterization tests for the analytics routes (B0.3 T1). They pin
 * today's HTTP behavior, including known quirks, so the layering refactor
 * is provably behavior-preserving. Do not "fix" an assertion here without
 * recording it in odd/tasks/b0/b0-3-route-tests.md.
 */
describe("analytics routes", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;

  // Portfolio with two positions:
  //   stockAsset  qty 10, avg 100, current 150 -> value 1500, P/L +500
  //   cryptoAsset qty  5, avg 250, current 200 -> value 1000, P/L -250
  let portfolioId: string;
  let emptyPortfolioId: string;
  let mixedCurrencyPortfolioId: string;
  let stockAsset: { id: string; symbol: string };
  let cryptoAsset: { id: string; symbol: string };

  const auth = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
  const allocationUrl = (id: string): string => `/api/v1/portfolios/${id}/analytics/allocation`;
  const attributionUrl = (id: string): string => `/api/v1/portfolios/${id}/analytics/attribution`;

  async function newAsset(
    prefix: string,
    assetType?: "CRYPTO",
  ): Promise<{ id: string; symbol: string }> {
    const handle = await createTestAsset(prefix);
    assetIds.push(handle.id);
    const asset = assetType
      ? await prisma.asset.update({ where: { id: handle.id }, data: { assetType } })
      : await prisma.asset.findUniqueOrThrow({ where: { id: handle.id } });
    return { id: asset.id, symbol: asset.symbol };
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);

    stockAsset = await newAsset("ANSTK");
    cryptoAsset = await newAsset("ANCRY", "CRYPTO");

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    await createTestPosition(portfolioId, stockAsset.id, {
      quantity: 10,
      averageEntryPrice: 100,
      currentPrice: 150,
    });
    await createTestPosition(portfolioId, cryptoAsset.id, {
      quantity: 5,
      averageEntryPrice: 250,
      currentPrice: 200,
    });

    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

    // One USD and one EUR position in the same portfolio: no FX exists.
    mixedCurrencyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Mixed" })).id;
    const usdPos = await newAsset("ANUSD");
    const eurPos = await newAsset("ANEUR");
    await createTestPosition(mixedCurrencyPortfolioId, usdPos.id);
    await prisma.position.create({
      data: {
        portfolioId: mixedCurrencyPortfolioId,
        assetId: eurPos.id,
        quantity: 1,
        currency: "EUR",
        averageEntryPrice: 100,
        currentPrice: 100,
        openedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("authentication", () => {
    it.each([
      ["allocation", allocationUrl],
      ["attribution", attributionUrl],
    ] as const)("rejects %s without a token with 401", async (_name, url) => {
      const response = await request(app).get(url(portfolioId));

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });

    it.each([
      ["allocation", allocationUrl],
      ["attribution", attributionUrl],
    ] as const)("rejects %s with an invalid token with 401", async (_name, url) => {
      const response = await request(app)
        .get(url(portfolioId))
        .set("Authorization", "Bearer not-a-valid-token");

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("ownership", () => {
    it.each([
      ["allocation", allocationUrl],
      ["attribution", attributionUrl],
    ] as const)("returns 404 for %s on another user's portfolio", async (_name, url) => {
      const response = await request(app)
        .get(url(portfolioId))
        .set(...auth(otherToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });

    it.each([
      ["allocation", allocationUrl],
      ["attribution", attributionUrl],
    ] as const)("returns 404 for %s on a nonexistent portfolio", async (_name, url) => {
      const response = await request(app)
        .get(url("does-not-exist"))
        .set(...auth(ownerToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET allocation", () => {
    it("returns 400 VALIDATION_ERROR with details for an invalid groupBy", async () => {
      const response = await request(app)
        .get(`${allocationUrl(portfolioId)}?groupBy=sector`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.length).toBeGreaterThan(0);
      expect(error.details?.[0]?.field).toBe("groupBy");
    });

    it("defaults groupBy to asset", async () => {
      const response = await request(app)
        .get(allocationUrl(portfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<AllocationDto>>(response).data;
      expect(data.groupBy).toBe("asset");
      expect(data.groups).toHaveLength(2);
    });

    it("groups by asset, labelled with the symbol", async () => {
      const response = await request(app)
        .get(`${allocationUrl(portfolioId)}?groupBy=asset`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<AllocationDto>>(response).data;
      expect(data.groupBy).toBe("asset");
      expect(data.groups).toHaveLength(2);

      const stock = data.groups.find((g) => g.key === stockAsset.id);
      const crypto = data.groups.find((g) => g.key === cryptoAsset.id);
      expect(stock).toEqual({
        key: stockAsset.id,
        label: stockAsset.symbol,
        marketValue: { amount: "1500", currency: "USD" },
        percentage: 60,
      });
      expect(crypto).toEqual({
        key: cryptoAsset.id,
        label: cryptoAsset.symbol,
        marketValue: { amount: "1000", currency: "USD" },
        percentage: 40,
      });
    });

    it("groups by assetType, using the type as key and label", async () => {
      const response = await request(app)
        .get(`${allocationUrl(portfolioId)}?groupBy=assetType`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<AllocationDto>>(response).data;
      expect(data.groupBy).toBe("assetType");
      expect(data.groups).toHaveLength(2);
      expect(data.groups.find((g) => g.key === "STOCK")).toEqual({
        key: "STOCK",
        label: "STOCK",
        marketValue: { amount: "1500", currency: "USD" },
        percentage: 60,
      });
      expect(data.groups.find((g) => g.key === "CRYPTO")).toEqual({
        key: "CRYPTO",
        label: "CRYPTO",
        marketValue: { amount: "1000", currency: "USD" },
        percentage: 40,
      });
    });

    it("groups by currency into a single group at 100%", async () => {
      const response = await request(app)
        .get(`${allocationUrl(portfolioId)}?groupBy=currency`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<AllocationDto>>(response).data).toEqual({
        groupBy: "currency",
        groups: [
          {
            key: "USD",
            label: "USD",
            marketValue: { amount: "2500", currency: "USD" },
            percentage: 100,
          },
        ],
      });
    });

    it("returns an empty groups list for a portfolio without positions", async () => {
      const response = await request(app)
        .get(allocationUrl(emptyPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<AllocationDto>>(response).data).toEqual({
        groupBy: "asset",
        groups: [],
      });
    });

    it("returns 500 INTERNAL_ERROR for a mixed-currency portfolio (CurrencyMismatchError is unmapped)", async () => {
      const response = await request(app)
        .get(allocationUrl(mixedCurrencyPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(500);
      expect(body<ErrorEnvelope>(response).error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("GET attribution", () => {
    it("returns each position's unrealized P/L contribution with symbol and name", async () => {
      const response = await request(app)
        .get(attributionUrl(portfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<AttributionDto>>(response).data;
      expect(data.totalUnrealizedPnL).toEqual({ amount: "250", currency: "USD" });
      expect(data.items).toHaveLength(2);

      expect(data.items.find((i) => i.assetId === stockAsset.id)).toEqual({
        assetId: stockAsset.id,
        symbol: stockAsset.symbol,
        name: "Integration Test Asset",
        contribution: { amount: "500", currency: "USD" },
        percentageOfTotal: 200,
      });
      expect(data.items.find((i) => i.assetId === cryptoAsset.id)).toEqual({
        assetId: cryptoAsset.id,
        symbol: cryptoAsset.symbol,
        name: "Integration Test Asset",
        contribution: { amount: "-250", currency: "USD" },
        percentageOfTotal: -100,
      });
    });

    it("ignores query parameters it does not know", async () => {
      const response = await request(app)
        .get(`${attributionUrl(portfolioId)}?bogus=1`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<AttributionDto>>(response).data.items).toHaveLength(2);
    });

    it("rejects an invalid range query with 400 VALIDATION_ERROR", async () => {
      const response = await request(app)
        .get(`${attributionUrl(portfolioId)}?groupBy=bogus&from=garbage`)
        .set(...auth(ownerToken));

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("returns zero total in the base currency and no items for an empty portfolio", async () => {
      const response = await request(app)
        .get(attributionUrl(emptyPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<AttributionDto>>(response).data).toEqual({
        totalUnrealizedPnL: { amount: "0", currency: "USD" },
        items: [],
      });
    });

    it("returns 500 INTERNAL_ERROR for a mixed-currency portfolio (CurrencyMismatchError is unmapped)", async () => {
      const response = await request(app)
        .get(attributionUrl(mixedCurrencyPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(500);
      expect(body<ErrorEnvelope>(response).error.code).toBe("INTERNAL_ERROR");
    });
  });
});
