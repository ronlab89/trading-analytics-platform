import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Response } from "supertest";
import type { ZodType } from "zod";
import {
  alertResponseSchema,
  allocationResponseSchema,
  archivePortfolioResponseSchema,
  archiveScenarioResponseSchema,
  assetResponseSchema,
  attributionResponseSchema,
  createTransactionResponseSchema,
  dataEnvelope,
  decisionReplayResponseSchema,
  decisionResponseSchema,
  historicalPriceResponseSchema,
  marketPriceResponseSchema,
  notificationResponseSchema,
  overviewResponseSchema,
  pageEnvelope,
  portfolioResponseSchema,
  positionDetailResponseSchema,
  positionResponseSchema,
  scenarioCalculationResponseSchema,
  scenarioComparisonResponseSchema,
  scenarioResponseSchema,
  transactionResponseSchema,
  userPreferenceResponseSchema,
  watchlistItemResponseSchema,
} from "@trading/contracts";
import { createApp } from "../app.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestDecision,
  createTestHistoricalPrice,
  createTestMarketPrice,
  createTestNotification,
  createTestPortfolio,
  createTestPosition,
  createTestScenario,
  createTestUser,
} from "../test-utils/fixtures.js";

/**
 * B0.4 T6: every successful endpoint returns exactly what its response
 * schema in `@trading/contracts` describes: every field present with the
 * right type. Zod objects strip unknown keys instead of failing, so extra
 * fields are guarded by the presenter unit tests (`*.response.test.ts`),
 * not here.
 */
describe("API responses match the @trading/contracts response schemas", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let portfolioId: string;
  let archivablePortfolioId: string;
  let assetId: string;
  let watchedAssetId: string;
  let positionId: string;
  let notificationId: string;
  let decisionId: string;
  let scenarioId: string;
  let secondScenarioId: string;
  let archivableScenarioId: string;
  let alertId: string;
  let transactionId: string;

  const auth = (): [string, string] => ["Authorization", `Bearer ${token}`];

  function expectContract(response: Response, status: number, schema: ZodType): void {
    expect(response.status).toBe(status);
    const parsed = schema.safeParse(response.body);
    if (!parsed.success) {
      throw new Error(`Response does not match its schema: ${JSON.stringify(parsed.error.issues)}`);
    }
  }

  beforeAll(async () => {
    const { user } = await createTestUser();
    userIds.push(user.id);
    token = tokenFor(user.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    archivablePortfolioId = (await createTestPortfolio(user.id, { name: "To archive" })).id;

    assetId = (await createTestAsset("CTR")).id;
    watchedAssetId = (await createTestAsset("CTW")).id;
    assetIds.push(assetId, watchedAssetId);
    await createTestMarketPrice(assetId, { price: 110, previousPrice: 100 });
    await createTestMarketPrice(watchedAssetId);
    await createTestHistoricalPrice(assetId, new Date("2026-05-01T00:00:00Z"));
    await createTestHistoricalPrice(assetId, new Date("2026-05-02T00:00:00Z"));

    positionId = (await createTestPosition(portfolioId, assetId, { currentPrice: 110 })).id;
    notificationId = (await createTestNotification(user.id)).id;
    decisionId = (
      await createTestDecision(portfolioId, assetId, {
        events: [
          {
            type: "POSITION_OPENED",
            timestamp: new Date("2026-06-02T14:00:00Z"),
            payload: { quantity: 10, price: 100 },
          },
          {
            type: "PRICE_UPDATE",
            timestamp: new Date("2026-06-03T14:00:00Z"),
            payload: { price: 110 },
          },
        ],
      })
    ).id;
    const changes = [{ assetId, percentChange: -10 }];
    scenarioId = (await createTestScenario(portfolioId, { changes })).id;
    secondScenarioId = (await createTestScenario(portfolioId, { name: "Second", changes })).id;
    archivableScenarioId = (await createTestScenario(portfolioId, { name: "To archive" })).id;

    // Records without a seeding fixture are created through the API itself.
    const alert = await request(app)
      .post("/api/v1/alerts")
      .set(...auth())
      .send({ assetId, type: "PRICE", condition: "ABOVE", threshold: 150 });
    alertId = (alert.body as { data: { id: string } }).data.id;

    const transaction = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set(...auth())
      .send({ assetId, type: "BUY", quantity: 1, price: { amount: "100", currency: "USD" } });
    transactionId = (transaction.body as { data: { transaction: { id: string } } }).data.transaction
      .id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("preferences", () => {
    it("GET /preferences is null before the first save", async () => {
      const response = await request(app)
        .get("/api/v1/preferences")
        .set(...auth());
      expectContract(response, 200, dataEnvelope(userPreferenceResponseSchema.nullable()));
    });

    it("PATCH then GET /preferences", async () => {
      const patch = await request(app)
        .patch("/api/v1/preferences")
        .set(...auth())
        .send({ theme: "dark", language: "es", notificationPreferences: { email: false } });
      expectContract(patch, 200, dataEnvelope(userPreferenceResponseSchema));

      const get = await request(app)
        .get("/api/v1/preferences")
        .set(...auth());
      expectContract(get, 200, dataEnvelope(userPreferenceResponseSchema));
    });
  });

  describe("watchlist", () => {
    it("POST /watchlist and GET /watchlist", async () => {
      const add = await request(app)
        .post("/api/v1/watchlist")
        .set(...auth())
        .send({ assetId: watchedAssetId });
      expectContract(add, 201, dataEnvelope(watchlistItemResponseSchema));

      const list = await request(app)
        .get("/api/v1/watchlist")
        .set(...auth());
      expectContract(list, 200, dataEnvelope(watchlistItemResponseSchema.array()));
    });
  });

  describe("notifications", () => {
    it("lists and marks one as read", async () => {
      const list = await request(app)
        .get("/api/v1/notifications")
        .set(...auth());
      expectContract(list, 200, dataEnvelope(notificationResponseSchema.array()));

      const read = await request(app)
        .post(`/api/v1/notifications/${notificationId}/read`)
        .set(...auth());
      expectContract(read, 200, dataEnvelope(notificationResponseSchema));
    });
  });

  describe("alerts", () => {
    it("lists, reads and updates", async () => {
      const list = await request(app)
        .get("/api/v1/alerts")
        .set(...auth());
      expectContract(list, 200, dataEnvelope(alertResponseSchema.array()));

      const one = await request(app)
        .get(`/api/v1/alerts/${alertId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(alertResponseSchema));

      const patch = await request(app)
        .patch(`/api/v1/alerts/${alertId}`)
        .set(...auth())
        .send({ threshold: 160 });
      expectContract(patch, 200, dataEnvelope(alertResponseSchema));
    });
  });

  describe("assets and market", () => {
    it("lists assets with pagination meta", async () => {
      const response = await request(app)
        .get("/api/v1/assets")
        .query({ search: "CTR" })
        .set(...auth());
      expectContract(response, 200, pageEnvelope(assetResponseSchema));
    });

    it("reads an asset, its price and its history", async () => {
      const asset = await request(app)
        .get(`/api/v1/assets/${assetId}`)
        .set(...auth());
      expectContract(asset, 200, dataEnvelope(assetResponseSchema));

      const price = await request(app)
        .get(`/api/v1/assets/${assetId}/price`)
        .set(...auth());
      expectContract(price, 200, dataEnvelope(marketPriceResponseSchema));

      const history = await request(app)
        .get(`/api/v1/assets/${assetId}/history`)
        .query({ from: "2026-01-01T00:00:00Z", to: "2026-12-31T00:00:00Z" })
        .set(...auth());
      expectContract(history, 200, dataEnvelope(historicalPriceResponseSchema.array()));
    });

    it("reads a batch of prices", async () => {
      const response = await request(app)
        .get("/api/v1/market/prices")
        .query({ assetIds: assetId })
        .set(...auth());
      expectContract(response, 200, dataEnvelope(marketPriceResponseSchema.array()));
    });
  });

  describe("portfolios", () => {
    it("lists, reads and updates", async () => {
      const list = await request(app)
        .get("/api/v1/portfolios")
        .set(...auth());
      expectContract(list, 200, dataEnvelope(portfolioResponseSchema.array()));

      const one = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(portfolioResponseSchema));

      const patch = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}`)
        .set(...auth())
        .send({ name: "Renamed" });
      expectContract(patch, 200, dataEnvelope(portfolioResponseSchema));
    });

    it("creates a portfolio", async () => {
      const response = await request(app)
        .post("/api/v1/portfolios")
        .set(...auth())
        .send({ name: "Created by contract test", baseCurrency: "USD" });
      expectContract(response, 201, dataEnvelope(portfolioResponseSchema));
    });

    it("archives a portfolio, twice, with the alreadyArchived meta", async () => {
      for (const alreadyArchived of [false, true]) {
        const response = await request(app)
          .post(`/api/v1/portfolios/${archivablePortfolioId}/archive`)
          .set(...auth());
        expectContract(response, 200, archivePortfolioResponseSchema);
        expect((response.body as { meta: { alreadyArchived: boolean } }).meta.alreadyArchived).toBe(
          alreadyArchived,
        );
      }
    });
  });

  describe("positions, overview and analytics", () => {
    it("lists positions and reads one with its metrics", async () => {
      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/positions`)
        .set(...auth());
      expectContract(list, 200, dataEnvelope(positionResponseSchema.array()));

      const one = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/positions/${positionId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(positionDetailResponseSchema));
    });

    it("reads the overview", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/overview`)
        .set(...auth());
      expectContract(response, 200, dataEnvelope(overviewResponseSchema));
    });

    it("reads allocation and attribution", async () => {
      const allocation = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/analytics/allocation`)
        .set(...auth());
      expectContract(allocation, 200, dataEnvelope(allocationResponseSchema));

      const attribution = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/analytics/attribution`)
        .set(...auth());
      expectContract(attribution, 200, dataEnvelope(attributionResponseSchema));
    });
  });

  describe("transactions", () => {
    it("creates, lists and reads", async () => {
      const create = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set(...auth())
        .send({ assetId, type: "BUY", quantity: 2, price: { amount: "101.5", currency: "USD" } });
      expectContract(create, 201, dataEnvelope(createTransactionResponseSchema));

      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions`)
        .set(...auth());
      expectContract(list, 200, pageEnvelope(transactionResponseSchema));

      const one = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/transactions/${transactionId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(transactionResponseSchema));
    });
  });

  describe("decisions", () => {
    it("lists, reads and replays", async () => {
      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .set(...auth());
      expectContract(list, 200, dataEnvelope(decisionResponseSchema.array()));

      const one = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions/${decisionId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(decisionResponseSchema));

      const replay = await request(app)
        .get(`/api/v1/decisions/${decisionId}/replay`)
        .set(...auth());
      expectContract(replay, 200, dataEnvelope(decisionReplayResponseSchema));
    });
  });

  describe("scenarios", () => {
    it("creates, lists, reads and updates", async () => {
      const create = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .set(...auth())
        .send({ name: "Created", changes: [{ assetId, percentChange: 5 }] });
      expectContract(create, 201, dataEnvelope(scenarioResponseSchema));

      const list = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios`)
        .set(...auth());
      expectContract(list, 200, dataEnvelope(scenarioResponseSchema.array()));

      const one = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/scenarios/${scenarioId}`)
        .set(...auth());
      expectContract(one, 200, dataEnvelope(scenarioResponseSchema));

      const patch = await request(app)
        .patch(`/api/v1/portfolios/${portfolioId}/scenarios/${scenarioId}`)
        .set(...auth())
        .send({ name: "Renamed" });
      expectContract(patch, 200, dataEnvelope(scenarioResponseSchema));
    });

    it("calculates and compares", async () => {
      const calculate = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/scenarios/${scenarioId}/calculate`)
        .set(...auth());
      expectContract(calculate, 200, dataEnvelope(scenarioCalculationResponseSchema));

      const compare = await request(app)
        .post(`/api/v1/portfolios/${portfolioId}/scenarios/compare`)
        .set(...auth())
        .send({ scenarioIds: [scenarioId, secondScenarioId] });
      expectContract(compare, 200, dataEnvelope(scenarioComparisonResponseSchema));
    });

    it("archives a scenario, twice, with the alreadyArchived meta", async () => {
      for (const alreadyArchived of [false, true]) {
        const response = await request(app)
          .post(`/api/v1/portfolios/${portfolioId}/scenarios/${archivableScenarioId}/archive`)
          .set(...auth());
        expectContract(response, 200, archiveScenarioResponseSchema);
        expect((response.body as { meta: { alreadyArchived: boolean } }).meta.alreadyArchived).toBe(
          alreadyArchived,
        );
      }
    });
  });
});
