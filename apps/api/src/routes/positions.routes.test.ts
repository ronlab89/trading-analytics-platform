import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
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

interface PositionDto {
  id: string;
  portfolioId: string;
  assetId: string;
  quantity: number;
  averageEntryPrice: MoneyDto;
  currentPrice: MoneyDto;
  openedAt: string;
  updatedAt: string;
}

interface MetricsDto {
  marketValue: MoneyDto;
  costBasis: MoneyDto;
  unrealizedPnL: MoneyDto;
  unrealizedPnLPercent: number;
}

interface PositionDetailDto {
  position: PositionDto;
  metrics: MetricsDto;
}

/**
 * Characterization tests for the positions routes (B0.3 T2). They pin
 * today's HTTP behavior, including known quirks, so the layering refactor
 * is provably behavior-preserving. Do not "fix" an assertion here without
 * recording it in odd/tasks/b0/b0-3-route-tests.md.
 */
describe("positions routes", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerToken: string;
  let otherToken: string;

  // Portfolio with two positions:
  //   assetA qty 10, avg 100, current 150 -> value 1500, cost 1000, P/L +500 (+50%)
  //   assetB qty  5, avg 250, current 200 -> value 1000, cost 1250, P/L -250 (-20%)
  let portfolioId: string;
  let emptyPortfolioId: string;
  let zeroCostPortfolioId: string;
  let otherPortfolioId: string;
  let positionAId: string;
  let positionBId: string;
  let otherPortfolioPositionId: string;
  let zeroCostPositionId: string;
  let assetAId: string;
  let assetBId: string;

  const auth = (token: string): [string, string] => ["Authorization", `Bearer ${token}`];
  const listUrl = (id: string): string => `/api/v1/portfolios/${id}/positions`;
  const detailUrl = (id: string, positionId: string): string =>
    `/api/v1/portfolios/${id}/positions/${positionId}`;

  async function newAssetId(prefix: string): Promise<string> {
    const handle = await createTestAsset(prefix);
    assetIds.push(handle.id);
    return handle.id;
  }

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);

    assetAId = await newAssetId("POSA");
    assetBId = await newAssetId("POSB");

    portfolioId = (await createTestPortfolio(owner.user.id)).id;
    positionAId = (
      await createTestPosition(portfolioId, assetAId, {
        quantity: 10,
        averageEntryPrice: 100,
        currentPrice: 150,
      })
    ).id;
    positionBId = (
      await createTestPosition(portfolioId, assetBId, {
        quantity: 5,
        averageEntryPrice: 250,
        currentPrice: 200,
      })
    ).id;

    emptyPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Empty" })).id;

    // A second portfolio of the same owner, to prove the portfolio id in
    // the URL scopes the position lookup.
    otherPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Second" })).id;
    otherPortfolioPositionId = (
      await createTestPosition(otherPortfolioId, await newAssetId("POSC"))
    ).id;

    zeroCostPortfolioId = (await createTestPortfolio(owner.user.id, { name: "Zero cost" })).id;
    zeroCostPositionId = (
      await createTestPosition(zeroCostPortfolioId, await newAssetId("POSZ"), {
        averageEntryPrice: 0,
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authentication", () => {
    it.each([
      ["list", () => listUrl(portfolioId)],
      ["detail", () => detailUrl(portfolioId, positionAId)],
    ] as const)("rejects %s without a token with 401", async (_name, url) => {
      const response = await request(app).get(url());

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });

    it.each([
      ["list", () => listUrl(portfolioId)],
      ["detail", () => detailUrl(portfolioId, positionAId)],
    ] as const)("rejects %s with an invalid token with 401", async (_name, url) => {
      const response = await request(app)
        .get(url())
        .set("Authorization", "Bearer not-a-valid-token");

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("ownership", () => {
    it.each([
      ["list", () => listUrl(portfolioId)],
      ["detail", () => detailUrl(portfolioId, positionAId)],
    ] as const)("returns 404 for %s on another user's portfolio", async (_name, url) => {
      const response = await request(app)
        .get(url())
        .set(...auth(otherToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });

    it.each([
      ["list", () => listUrl("does-not-exist")],
      ["detail", () => detailUrl("does-not-exist", positionAId)],
    ] as const)("returns 404 for %s on a nonexistent portfolio", async (_name, url) => {
      const response = await request(app)
        .get(url())
        .set(...auth(ownerToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET list", () => {
    it("returns the portfolio's positions with exact fields", async () => {
      const response = await request(app)
        .get(listUrl(portfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<PositionDto[]>>(response).data;
      expect(data).toHaveLength(2);

      expect(data.find((p) => p.id === positionAId)).toEqual({
        id: positionAId,
        portfolioId,
        assetId: assetAId,
        quantity: 10,
        averageEntryPrice: { amount: "100", currency: "USD" },
        currentPrice: { amount: "150", currency: "USD" },
        openedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: expect.any(String) as string,
      });
      expect(data.find((p) => p.id === positionBId)).toEqual({
        id: positionBId,
        portfolioId,
        assetId: assetBId,
        quantity: 5,
        averageEntryPrice: { amount: "250", currency: "USD" },
        currentPrice: { amount: "200", currency: "USD" },
        openedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: expect.any(String) as string,
      });
    });

    it("does not include positions of another portfolio", async () => {
      const response = await request(app)
        .get(listUrl(portfolioId))
        .set(...auth(ownerToken));

      const ids = body<DataEnvelope<PositionDto[]>>(response).data.map((p) => p.id);
      expect(ids).not.toContain(otherPortfolioPositionId);
    });

    it("does not include derived metrics on list items", async () => {
      const response = await request(app)
        .get(listUrl(portfolioId))
        .set(...auth(ownerToken));

      for (const item of body<DataEnvelope<PositionDto[]>>(response).data) {
        expect(Object.keys(item).sort()).toEqual([
          "assetId",
          "averageEntryPrice",
          "currentPrice",
          "id",
          "openedAt",
          "portfolioId",
          "quantity",
          "updatedAt",
        ]);
      }
    });

    it("returns an empty list for a portfolio without positions", async () => {
      const response = await request(app)
        .get(listUrl(emptyPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: [] });
    });

    it("lists a zero-cost position as a plain record (metrics are not computed)", async () => {
      const response = await request(app)
        .get(listUrl(zeroCostPortfolioId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<PositionDto[]>>(response).data;
      expect(data).toHaveLength(1);
      expect(data[0]?.averageEntryPrice).toEqual({ amount: "0", currency: "USD" });
    });
  });

  describe("GET detail", () => {
    it("returns the position with its derived metrics (profit)", async () => {
      const response = await request(app)
        .get(detailUrl(portfolioId, positionAId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<PositionDetailDto>>(response).data).toEqual({
        position: {
          id: positionAId,
          portfolioId,
          assetId: assetAId,
          quantity: 10,
          averageEntryPrice: { amount: "100", currency: "USD" },
          currentPrice: { amount: "150", currency: "USD" },
          openedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: expect.any(String) as string,
        },
        metrics: {
          marketValue: { amount: "1500", currency: "USD" },
          costBasis: { amount: "1000", currency: "USD" },
          unrealizedPnL: { amount: "500", currency: "USD" },
          unrealizedPnLPercent: 50,
        },
      });
    });

    it("returns negative unrealized P/L for a losing position", async () => {
      const response = await request(app)
        .get(detailUrl(portfolioId, positionBId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(200);
      const data = body<DataEnvelope<PositionDetailDto>>(response).data;
      expect(data.position.id).toBe(positionBId);
      expect(data.metrics).toEqual({
        marketValue: { amount: "1000", currency: "USD" },
        costBasis: { amount: "1250", currency: "USD" },
        unrealizedPnL: { amount: "-250", currency: "USD" },
        unrealizedPnLPercent: -20,
      });
    });

    it("returns 404 for a position that belongs to another portfolio (same owner)", async () => {
      const response = await request(app)
        .get(detailUrl(portfolioId, otherPortfolioPositionId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for a random position id", async () => {
      const response = await request(app)
        .get(detailUrl(portfolioId, crypto.randomUUID()))
        .set(...auth(ownerToken));

      expect(response.status).toBe(404);
      expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
    });

    it("uses the same 404 body for a foreign position and a nonexistent one (anti-enumeration)", async () => {
      const foreign = await request(app)
        .get(detailUrl(portfolioId, otherPortfolioPositionId))
        .set(...auth(ownerToken));
      const missing = await request(app)
        .get(detailUrl(portfolioId, crypto.randomUUID()))
        .set(...auth(ownerToken));

      expect(foreign.status).toBe(missing.status);
      const foreignError = body<ErrorEnvelope>(foreign).error;
      const missingError = body<ErrorEnvelope>(missing).error;
      expect(foreignError.code).toBe(missingError.code);
      expect(foreignError.message).toBe(missingError.message);
    });

    it("returns 500 INTERNAL_ERROR for a zero average entry price, caused by PositionMetricsCalculationError", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await request(app)
        .get(detailUrl(zeroCostPortfolioId, zeroCostPositionId))
        .set(...auth(ownerToken));

      expect(response.status).toBe(500);
      expect(body<ErrorEnvelope>(response).error.code).toBe("INTERNAL_ERROR");

      const logged = errorSpy.mock.calls
        .map(([entry]) => (typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.startsWith("{"))
        .map((entry) => JSON.parse(entry) as { errorName?: string; event?: string });
      expect(logged.map((entry) => entry.errorName)).toContain("PositionMetricsCalculationError");
    });
  });
});
