import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { tokenFor } from "../test-utils/auth.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestDecision,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

interface MoneyDto {
  amount: string;
  currency: string;
}

interface DecisionDto {
  id: string;
  portfolioId: string;
  assetId: string;
  title: string;
  direction: string;
  entryPrice: MoneyDto | null;
}

interface ReplayEventDto {
  type: string;
  timestamp: string;
}

interface ReplayStateDto {
  currentIndex: number;
  totalEvents: number;
  currentEvent: ReplayEventDto | null;
  phase: string;
  thesis: string | null;
  position: unknown;
  lastPrice: MoneyDto | null;
  unrealizedPnL: MoneyDto | null;
  realizedPnL: MoneyDto | null;
  issues: unknown[];
}

interface ReplayDto {
  decision: DecisionDto;
  events: ReplayEventDto[];
  currency: string;
  initialState: ReplayStateDto;
}

const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Integration tests for the Decisions read API.
 * Source: FR-032 (List Decisions), FR-033 (Decision Detail),
 * FR-034 (Replay Decision), 07-api-spec.md §23-24.
 */
describe("decisions", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let token: string;
  let otherUserToken: string;
  let portfolioId: string;
  let secondPortfolioId: string;
  let assetId: string;
  let otherAssetId: string;
  let longDecisionId: string;
  let shortDecisionId: string;
  let replayDecisionId: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    userIds.push(user.id, otherUser.id);
    token = tokenFor(user.id);
    otherUserToken = tokenFor(otherUser.id);

    portfolioId = (await createTestPortfolio(user.id)).id;
    secondPortfolioId = (await createTestPortfolio(user.id, { name: "Second portfolio" })).id;

    assetId = (await createTestAsset()).id;
    otherAssetId = (await createTestAsset("OTH")).id;
    assetIds.push(assetId, otherAssetId);

    longDecisionId = (
      await createTestDecision(portfolioId, assetId, { title: "Long decision", direction: "LONG" })
    ).id;
    shortDecisionId = (
      await createTestDecision(portfolioId, otherAssetId, {
        title: "Short decision",
        direction: "SHORT",
      })
    ).id;

    // Events are inserted out of chronological order on purpose: the
    // API must return them sorted by their real timestamp.
    replayDecisionId = (
      await createTestDecision(portfolioId, assetId, {
        title: "Replay decision",
        events: [
          {
            type: "POSITION_OPENED",
            timestamp: new Date("2026-06-02T14:00:00Z"),
            payload: { quantity: 10, price: 150 },
          },
          {
            type: "POSITION_CLOSED",
            timestamp: new Date("2026-06-10T14:00:00Z"),
            payload: { price: 170 },
          },
          { type: "DECISION_CREATED", timestamp: new Date("2026-06-01T14:00:00Z") },
          {
            type: "PRICE_UPDATE",
            timestamp: new Date("2026-06-05T14:00:00Z"),
            payload: { price: 160 },
          },
        ],
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  describe("GET /api/v1/portfolios/:portfolioId/decisions", () => {
    it("lists the decisions of the caller's portfolio", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<DecisionDto[]>>(response);
      expect(data.map((d) => d.id).sort()).toEqual(
        [longDecisionId, shortDecisionId, replayDecisionId].sort(),
      );
    });

    it("returns an empty list for a portfolio without decisions", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${secondPortfolioId}/decisions`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<DecisionDto[]>>(response).data).toEqual([]);
    });

    it("filters by direction", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .query({ direction: "SHORT" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<DecisionDto[]>>(response);
      expect(data.map((d) => d.id)).toEqual([shortDecisionId]);
    });

    it("filters by asset", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .query({ assetId: otherAssetId })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<DecisionDto[]>>(response);
      expect(data.map((d) => d.id)).toEqual([shortDecisionId]);
    });

    it("returns an empty list when the date range excludes every decision", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .query({ dateFrom: "2030-01-01T00:00:00Z" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(body<DataEnvelope<DecisionDto[]>>(response).data).toEqual([]);
    });

    it("rejects an invalid direction with 400", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .query({ direction: "SIDEWAYS" })
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 for a portfolio owned by another user", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).get(`/api/v1/portfolios/${portfolioId}/decisions`);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/portfolios/:portfolioId/decisions/:decisionId", () => {
    it("returns the decision with its prices as money values", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions/${longDecisionId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<DecisionDto>>(response);
      expect(data.id).toBe(longDecisionId);
      expect(data.title).toBe("Long decision");
      expect(data.direction).toBe("LONG");
      expect(data.entryPrice).toEqual({ amount: "150", currency: "USD" });
    });

    it("returns 404 for a decision that does not exist", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions/${NON_EXISTENT_ID}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 when the decision belongs to a different portfolio", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${secondPortfolioId}/decisions/${longDecisionId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it("returns 404 for another user's portfolio", async () => {
      const response = await request(app)
        .get(`/api/v1/portfolios/${portfolioId}/decisions/${longDecisionId}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).get(
        `/api/v1/portfolios/${portfolioId}/decisions/${longDecisionId}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/decisions/:decisionId/replay", () => {
    it("returns the decision, its events in chronological order and the asset currency", async () => {
      const response = await request(app)
        .get(`/api/v1/decisions/${replayDecisionId}/replay`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ReplayDto>>(response);
      expect(data.decision.id).toBe(replayDecisionId);
      expect(data.currency).toBe("USD");
      expect(data.events.map((e) => e.type)).toEqual([
        "DECISION_CREATED",
        "POSITION_OPENED",
        "PRICE_UPDATE",
        "POSITION_CLOSED",
      ]);
    });

    it("includes the projection before the first event as initialState", async () => {
      const response = await request(app)
        .get(`/api/v1/decisions/${replayDecisionId}/replay`)
        .set("Authorization", `Bearer ${token}`);

      const { initialState } = body<DataEnvelope<ReplayDto>>(response).data;
      expect(initialState.currentIndex).toBe(-1);
      expect(initialState.totalEvents).toBe(4);
      expect(initialState.currentEvent).toBeNull();
      expect(initialState.phase).toBe("PLANNED");
      expect(initialState.position).toBeNull();
      expect(initialState.lastPrice).toBeNull();
      expect(initialState.unrealizedPnL).toBeNull();
      expect(initialState.realizedPnL).toBeNull();
      expect(initialState.issues).toEqual([]);
    });

    it("returns an empty timeline for a decision without events", async () => {
      const response = await request(app)
        .get(`/api/v1/decisions/${longDecisionId}/replay`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<ReplayDto>>(response);
      expect(data.events).toEqual([]);
      expect(data.initialState.totalEvents).toBe(0);
      expect(data.initialState.phase).toBe("PLANNED");
    });

    it("returns 404 for a decision that does not exist", async () => {
      const response = await request(app)
        .get(`/api/v1/decisions/${NON_EXISTENT_ID}/replay`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it("returns the same 404 for a decision owned by another user", async () => {
      const response = await request(app)
        .get(`/api/v1/decisions/${replayDecisionId}/replay`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);
    });

    it("returns 401 without a token", async () => {
      const response = await request(app).get(`/api/v1/decisions/${replayDecisionId}/replay`);

      expect(response.status).toBe(401);
    });
  });
});
