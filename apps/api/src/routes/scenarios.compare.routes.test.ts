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

interface AssetRowDto {
  assetId: string;
  symbol: string | null;
  name: string | null;
  value: MoneyDto;
  allocationPercent: number;
  valueDifference?: MoneyDto;
  allocationShift?: number;
}

interface ComparisonDto {
  baseline: {
    metrics: { totalValue: MoneyDto };
    assets: AssetRowDto[];
  };
  scenarios: {
    scenarioId: string;
    name: string;
    status: string;
    metrics: { totalValue: MoneyDto };
    difference: {
      totalValue: MoneyDto;
      totalValuePercent: number | null;
      unrealizedPnL: MoneyDto;
    };
    assets: AssetRowDto[];
    unmatchedAssetIds: string[];
  }[];
}

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Integration tests for POST .../scenarios/compare.
 * Source: FR-042 (Compare Scenarios), 01-product-spec.md §15.2.
 *
 * Baseline used throughout: 10 x assetA at 100 and 5 x assetB at 200,
 * so total value is 2000 split 50/50.
 */
describe("scenarios compare", () => {
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
  let unmatchedId: string;
  let fifthId: string;
  let emptyPortfolioScenarioId: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    userIds.push(user.id, otherUser.id);
    token = tokenFor(user.id);
    otherUserToken = tokenFor(otherUser.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    emptyPortfolioId = (await createTestPortfolio(user.id, { name: "Empty portfolio" })).id;

    assetAId = (await createTestAsset("CMA")).id;
    assetBId = (await createTestAsset("CMB")).id;
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

    rallyId = (
      await createTestScenario(portfolioId, {
        name: "Rally",
        status: "DRAFT",
        changes: [{ assetId: assetAId, percentChange: 10 }],
      })
    ).id;
    crashId = (
      await createTestScenario(portfolioId, {
        name: "Crash",
        status: "SAVED",
        changes: [
          { assetId: assetBId, percentChange: -20 },
          { assetId: assetAId, percentChange: -50 },
        ],
      })
    ).id;
    archivedId = (
      await createTestScenario(portfolioId, {
        name: "Old idea",
        status: "ARCHIVED",
        changes: [{ assetId: assetBId, percentChange: 5 }],
      })
    ).id;
    unmatchedId = (
      await createTestScenario(portfolioId, {
        name: "Sold position",
        changes: [
          { assetId: assetAId, percentChange: 10 },
          { assetId: "asset-not-held", percentChange: 20 },
        ],
      })
    ).id;
    fifthId = (
      await createTestScenario(portfolioId, {
        name: "Fifth",
        changes: [{ assetId: assetBId, percentChange: 1 }],
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

  function compare(scenarioIds: unknown, forPortfolioId = portfolioId, authToken = token) {
    return request(app)
      .post(`/api/v1/portfolios/${forPortfolioId}/scenarios/compare`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ scenarioIds });
  }

  describe("successful comparisons", () => {
    it("reports the baseline with the value and allocation of each asset", async () => {
      const response = await compare([rallyId]);

      expect(response.status).toBe(200);
      const { baseline } = body<DataEnvelope<ComparisonDto>>(response).data;
      expect(baseline.metrics.totalValue).toEqual({ amount: "2000", currency: "USD" });
      expect(baseline.assets).toHaveLength(2);
      expect(baseline.assets.map((a) => a.allocationPercent)).toEqual([50, 50]);
      // createTestAsset appends a unique suffix to the prefix it is given.
      expect(baseline.assets.map((a) => a.symbol?.split("-")[0]).sort()).toEqual(["CMA", "CMB"]);
    });

    it("reports the portfolio-level difference of a scenario", async () => {
      const response = await compare([rallyId]);

      const [rally] = body<DataEnvelope<ComparisonDto>>(response).data.scenarios;
      expect(rally?.scenarioId).toBe(rallyId);
      expect(rally?.name).toBe("Rally");
      expect(rally?.status).toBe("DRAFT");
      expect(rally?.metrics.totalValue).toEqual({ amount: "2100", currency: "USD" });
      expect(rally?.difference.totalValue).toEqual({ amount: "100", currency: "USD" });
      expect(rally?.difference.unrealizedPnL).toEqual({ amount: "100", currency: "USD" });
      expect(rally?.difference.totalValuePercent).toBeCloseTo(5, 6);
    });

    it("breaks the difference down per asset, with allocation shift", async () => {
      const response = await compare([rallyId]);

      const [rally] = body<DataEnvelope<ComparisonDto>>(response).data.scenarios;
      const assetA = rally?.assets.find((a) => a.assetId === assetAId);
      const assetB = rally?.assets.find((a) => a.assetId === assetBId);

      expect(assetA?.symbol).toMatch(/^CMA-/);
      expect(assetA?.value).toEqual({ amount: "1100", currency: "USD" });
      expect(assetA?.valueDifference).toEqual({ amount: "100", currency: "USD" });
      expect(assetA?.allocationShift).toBeCloseTo(2.380952, 5);
      expect(assetB?.valueDifference).toEqual({ amount: "0", currency: "USD" });
      expect(assetB?.allocationShift).toBeCloseTo(-2.380952, 5);
    });

    it("orders a scenario's assets by the size of their difference", async () => {
      const response = await compare([crashId]);

      const [crash] = body<DataEnvelope<ComparisonDto>>(response).data.scenarios;
      // assetA: -500, assetB: -200 (changes were stored in the opposite order)
      expect(crash?.assets.map((a) => a.assetId)).toEqual([assetAId, assetBId]);
      expect(crash?.assets.map((a) => a.valueDifference?.amount)).toEqual(["-500", "-200"]);
      expect(crash?.difference.totalValuePercent).toBeCloseTo(-35, 6);
    });

    it("compares several scenarios side by side, in the requested order", async () => {
      const response = await compare([crashId, rallyId]);

      expect(response.status).toBe(200);
      const { scenarios } = body<DataEnvelope<ComparisonDto>>(response).data;
      expect(scenarios.map((s) => s.scenarioId)).toEqual([crashId, rallyId]);
      expect(scenarios[0]?.difference.totalValue.amount).toBe("-700");
      expect(scenarios[1]?.difference.totalValue.amount).toBe("100");
    });

    it("can compare an archived scenario", async () => {
      const response = await compare([archivedId]);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ComparisonDto>>(response).data.scenarios[0]?.status).toBe(
        "ARCHIVED",
      );
    });

    it("reports changes for assets the portfolio does not hold", async () => {
      const response = await compare([unmatchedId]);

      const [entry] = body<DataEnvelope<ComparisonDto>>(response).data.scenarios;
      expect(entry?.unmatchedAssetIds).toEqual(["asset-not-held"]);
      expect(entry?.difference.totalValue.amount).toBe("100");
    });

    it("handles a portfolio without positions", async () => {
      const response = await compare([emptyPortfolioScenarioId], emptyPortfolioId);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ComparisonDto>>(response);
      expect(data.baseline.assets).toEqual([]);
      expect(data.scenarios[0]?.assets).toEqual([]);
      expect(data.scenarios[0]?.difference.totalValuePercent).toBeNull();
    });

    it("does not modify the baseline portfolio", async () => {
      await compare([crashId, rallyId]);

      const positions = await prisma.position.findMany({
        where: { portfolioId },
        orderBy: { quantity: "desc" },
      });
      expect(positions.map((p) => p.currentPrice.toString())).toEqual(["100", "200"]);
    });

    it("returns the same result when repeated", async () => {
      const first = body<DataEnvelope<ComparisonDto>>(await compare([crashId, rallyId])).data;
      const second = body<DataEnvelope<ComparisonDto>>(await compare([crashId, rallyId])).data;

      expect(second).toEqual(first);
    });
  });

  describe("invalid requests", () => {
    it("rejects an empty list with 400", async () => {
      const response = await compare([]);

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects more than 5 scenarios with 400", async () => {
      const response = await compare([
        rallyId,
        crashId,
        archivedId,
        unmatchedId,
        emptyPortfolioScenarioId,
        NON_EXISTENT_ID,
      ]);

      expect(response.status).toBe(400);
    });

    it("accepts exactly 5 scenarios", async () => {
      const response = await compare([rallyId, crashId, archivedId, unmatchedId, fifthId]);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<ComparisonDto>>(response).data.scenarios).toHaveLength(5);
    });

    it("rejects repeated ids with 400", async () => {
      const response = await compare([rallyId, rallyId]);

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a missing or malformed list with 400", async () => {
      const missing = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/scenarios/compare`)
        .set("Authorization", `Bearer ${token}`)
        .send({});
      const notAList = await compare(rallyId);

      expect(missing.status).toBe(400);
      expect(notAList.status).toBe(400);
    });
  });

  describe("ownership and authentication", () => {
    it("returns 404 when any scenario does not exist", async () => {
      const response = await compare([rallyId, NON_EXISTENT_ID]);

      expect(response.status).toBe(404);
    });

    it("returns 404 when a scenario belongs to a different portfolio", async () => {
      const response = await compare([rallyId, emptyPortfolioScenarioId]);

      expect(response.status).toBe(404);
    });

    it("returns 404 for another user's portfolio", async () => {
      const response = await compare([rallyId], portfolioId, otherUserToken);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/scenarios/compare`)
        .send({ scenarioIds: [rallyId] });

      expect(response.status).toBe(401);
    });
  });
});
