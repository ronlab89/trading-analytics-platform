import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@trading/database";
import { createApp } from "../app.js";
import { tokenFor } from "../test-utils/auth.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
  createTestPosition,
  createTestScenario,
  createTestUser,
} from "../test-utils/fixtures.js";

interface MoneyDto {
  amount: string;
  currency: string;
}

interface ScenarioDto {
  id: string;
  portfolioId: string;
  name: string;
  status: string;
  changes: { assetId: string; percentChange: number }[];
}

interface MetricsDto {
  totalValue: MoneyDto;
  investedValue: MoneyDto;
  unrealizedPnL: MoneyDto;
  unrealizedPnLPercent: number;
}

interface CalculationDto {
  scenarioId: string;
  baseline: MetricsDto;
  result: MetricsDto;
  difference: { totalValue: MoneyDto; unrealizedPnL: MoneyDto };
  unmatchedAssetIds: string[];
}

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Integration tests for the Scenarios read API.
 * Source: FR-036 (isolation), FR-038 (Recalculate Scenario),
 * 07-api-spec.md §25, 05-data-model.md §15-16.
 *
 * Baseline used throughout: the portfolio holds 10 x assetA and 5 x
 * assetB, both bought and currently priced at 100 and 200, so the
 * baseline is totalValue 2000, unrealized P/L 0.
 */
describe("scenarios", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let otherUserToken: string;
  let portfolioId: string;
  let emptyPortfolioId: string;
  let assetAId: string;
  let assetBId: string;

  let rallyId: string;
  let crashId: string;
  let archivedId: string;
  let noChangesId: string;
  let unmatchedId: string;
  let emptyPortfolioScenarioId: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    userIds.push(user.id, otherUser.id);
    token = tokenFor(user.id);
    otherUserToken = tokenFor(otherUser.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(user.id, { name: "Empty portfolio" })).id;

    assetAId = (await createTestAsset("SCA")).id;
    assetBId = (await createTestAsset("SCB")).id;
    assetIds.push(assetAId, assetBId);

    await createTestPosition(portfolioId, assetAId, {
      quantity: 10,
      averageEntryPrice: 100,
      currentPrice: 100,
    });
    await createTestPosition(portfolioId, assetBId, {
      quantity: 5,
      averageEntryPrice: 200,
      currentPrice: 200,
    });

    // Created with increasing createdAt so the expected list order
    // (newest first) is known.
    rallyId = (
      await createTestScenario(portfolioId, {
        name: "Rally",
        status: "DRAFT",
        changes: [{ assetId: assetAId, percentChange: 10 }],
        createdAt: new Date("2026-06-01T00:00:00Z"),
      })
    ).id;
    crashId = (
      await createTestScenario(portfolioId, {
        name: "Crash",
        status: "SAVED",
        changes: [
          { assetId: assetAId, percentChange: -50 },
          { assetId: assetBId, percentChange: -20 },
        ],
        createdAt: new Date("2026-06-02T00:00:00Z"),
      })
    ).id;
    archivedId = (
      await createTestScenario(portfolioId, {
        name: "Old idea",
        status: "ARCHIVED",
        changes: [{ assetId: assetBId, percentChange: 5 }],
        createdAt: new Date("2026-06-03T00:00:00Z"),
      })
    ).id;
    noChangesId = (
      await createTestScenario(portfolioId, {
        name: "Untouched",
        createdAt: new Date("2026-06-04T00:00:00Z"),
      })
    ).id;
    unmatchedId = (
      await createTestScenario(portfolioId, {
        name: "Sold position",
        changes: [
          { assetId: assetAId, percentChange: 10 },
          { assetId: "asset-not-held", percentChange: 20 },
        ],
        createdAt: new Date("2026-06-05T00:00:00Z"),
      })
    ).id;
    emptyPortfolioScenarioId = (
      await createTestScenario(emptyPortfolioId, {
        name: "On an empty portfolio",
        changes: [{ assetId: assetAId, percentChange: 10 }],
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("GET /api/v1/portfolios/:portfolioId/scenarios", () => {
    it("lists the portfolio's scenarios, newest first", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ScenarioDto[]>>(response);
      expect(data.map((s) => s.id)).toEqual([
        unmatchedId,
        noChangesId,
        archivedId,
        crashId,
        rallyId,
      ]);
    });

    it("includes each scenario's changes", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .set("Authorization", `Bearer ${token}`);

      const { data } = body<DataEnvelope<ScenarioDto[]>>(response);
      const crash = data.find((s) => s.id === crashId);
      expect(crash?.changes).toEqual([
        { assetId: assetAId, percentChange: -50 },
        { assetId: assetBId, percentChange: -20 },
      ]);
    });

    it("filters by status", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .query({ status: "ARCHIVED" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ScenarioDto[]>>(response);
      expect(data.map((s) => s.id)).toEqual([archivedId]);
    });

    it("returns an empty list when no scenario matches the status", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${emptyPortfolioId}/scenarios`)
        .query({ status: "SAVED" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ScenarioDto[]>>(response).data).toEqual([]);
    });

    it("rejects an invalid status with 400", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .query({ status: "PUBLISHED" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 for a portfolio owned by another user", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).get(`/api/v1/portfolios/${portfolioId}/scenarios`);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/portfolios/:portfolioId/scenarios/:scenarioId", () => {
    it("returns the scenario with its changes", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios/${rallyId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ScenarioDto>>(response);
      expect(data.id).toBe(rallyId);
      expect(data.name).toBe("Rally");
      expect(data.status).toBe("DRAFT");
      expect(data.changes).toEqual([{ assetId: assetAId, percentChange: 10 }]);
    });

    it("returns 404 for a scenario that does not exist", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the scenario belongs to a different portfolio", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${emptyPortfolioId}/scenarios/${rallyId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 for another user's portfolio", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios/${rallyId}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).get(
        `/api/v1/portfolios/${portfolioId}/scenarios/${rallyId}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/portfolios/:portfolioId/scenarios/:scenarioId/calculate", () => {
    function calculate(scenarioId: string, forPortfolioId = portfolioId, authToken = token) {
      return request(app)
        .post(`/api/v1/portfolios/${forPortfolioId}/scenarios/${scenarioId}/calculate`)
        .set("Authorization", `Bearer ${authToken}`);
    }

    it("calculates the impact of a price increase", async () => {
      const response = await calculate(rallyId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<CalculationDto>>(response);
      expect(data.scenarioId).toBe(rallyId);
      expect(data.baseline.totalValue).toEqual({ amount: "2000", currency: "USD" });
      expect(data.baseline.unrealizedPnL).toEqual({ amount: "0", currency: "USD" });
      // assetA: 10 x 100 -> 10 x 110 = 1100, assetB unchanged = 1000
      expect(data.result.totalValue).toEqual({ amount: "2100", currency: "USD" });
      expect(data.result.unrealizedPnL).toEqual({ amount: "100", currency: "USD" });
      expect(data.difference.totalValue).toEqual({ amount: "100", currency: "USD" });
      expect(data.difference.unrealizedPnL).toEqual({ amount: "100", currency: "USD" });
      expect(data.unmatchedAssetIds).toEqual([]);
    });

    it("calculates the impact of several price drops", async () => {
      const response = await calculate(crashId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<CalculationDto>>(response);
      // assetA: 10 x 50 = 500, assetB: 5 x 160 = 800
      expect(data.result.totalValue).toEqual({ amount: "1300", currency: "USD" });
      expect(data.difference.totalValue).toEqual({ amount: "-700", currency: "USD" });
      expect(data.difference.unrealizedPnL).toEqual({ amount: "-700", currency: "USD" });
    });

    it("returns no difference for a scenario without changes", async () => {
      const response = await calculate(noChangesId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<CalculationDto>>(response);
      expect(data.result.totalValue).toEqual(data.baseline.totalValue);
      expect(data.difference.totalValue).toEqual({ amount: "0", currency: "USD" });
    });

    it("can calculate an archived scenario", async () => {
      const response = await calculate(archivedId);

      expect(response.status).toBe(200);
    });

    it("reports changes for assets the portfolio does not hold", async () => {
      const response = await calculate(unmatchedId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<CalculationDto>>(response);
      expect(data.unmatchedAssetIds).toEqual(["asset-not-held"]);
      // The matched change still applies: assetA +10% => +100.
      expect(data.difference.totalValue).toEqual({ amount: "100", currency: "USD" });
    });

    it("returns zeroed metrics for a portfolio without positions", async () => {
      const response = await calculate(emptyPortfolioScenarioId, emptyPortfolioId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<CalculationDto>>(response);
      expect(data.baseline.totalValue).toEqual({ amount: "0", currency: "USD" });
      expect(data.result.totalValue).toEqual({ amount: "0", currency: "USD" });
      expect(data.unmatchedAssetIds).toEqual([assetAId]);
    });

    it("does not modify the baseline portfolio", async () => {
      await calculate(crashId);

      const positions = await prisma.position.findMany({
        where: { portfolioId },
        orderBy: { quantity: "desc" },
      });
      expect(positions.map((p) => p.currentPrice.toString())).toEqual(["100", "200"]);
      expect(positions.map((p) => p.quantity.toString())).toEqual(["10", "5"]);
    });

    it("returns the same result when calculated repeatedly", async () => {
      const first = body<DataEnvelope<CalculationDto>>(await calculate(crashId)).data;
      const second = body<DataEnvelope<CalculationDto>>(await calculate(crashId)).data;

      expect(second).toEqual(first);
    });

    it("returns 404 for a scenario that does not exist", async () => {
      const response = await calculate(NON_EXISTENT_ID);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the scenario belongs to a different portfolio", async () => {
      const response = await calculate(rallyId, emptyPortfolioId);

      expect(response.status).toBe(404);
    });

    it("returns 404 for another user's portfolio", async () => {
      const response = await calculate(rallyId, portfolioId, otherUserToken);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).post(
        `/api/v1/portfolios/${portfolioId}/scenarios/${rallyId}/calculate`,
      );

      expect(response.status).toBe(401);
    });
  });
});
