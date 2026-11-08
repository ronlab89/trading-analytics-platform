import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * B0.4 T3: route parameters are validated like body and query. A malformed
 * value is 400 VALIDATION_ERROR; a well-formed unknown ID stays 404.
 */
const BAD = "bad%20id";
const OK = "does-not-exist";

type Method = "get" | "patch" | "post" | "delete";
const routes: [Method, (id: string) => string, string][] = [
  ["get", (id) => `/api/v1/assets/${id}`, "assetId"],
  ["get", (id) => `/api/v1/assets/${id}/price`, "assetId"],
  ["get", (id) => `/api/v1/assets/${id}/history`, "assetId"],
  ["delete", (id) => `/api/v1/watchlist/${id}`, "assetId"],
  ["get", (id) => `/api/v1/alerts/${id}`, "alertId"],
  ["patch", (id) => `/api/v1/alerts/${id}`, "alertId"],
  ["delete", (id) => `/api/v1/alerts/${id}`, "alertId"],
  ["post", (id) => `/api/v1/notifications/${id}/read`, "notificationId"],
  ["get", (id) => `/api/v1/decisions/${id}/replay`, "decisionId"],
  ["get", (id) => `/api/v1/portfolios/${id}`, "portfolioId"],
  ["patch", (id) => `/api/v1/portfolios/${id}`, "portfolioId"],
  ["post", (id) => `/api/v1/portfolios/${id}/archive`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/overview`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/positions`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/positions/${OK}`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${OK}/positions/${id}`, "positionId"],
  ["get", (id) => `/api/v1/portfolios/${id}/analytics/allocation`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/analytics/attribution`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/analytics/risk`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/analytics/performance`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${id}/decisions`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${OK}/decisions/${id}`, "decisionId"],
  ["get", (id) => `/api/v1/portfolios/${id}/transactions`, "portfolioId"],
  ["post", (id) => `/api/v1/portfolios/${id}/transactions`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${OK}/transactions/${id}`, "transactionId"],
  ["get", (id) => `/api/v1/portfolios/${id}/scenarios`, "portfolioId"],
  ["post", (id) => `/api/v1/portfolios/${id}/scenarios`, "portfolioId"],
  ["get", (id) => `/api/v1/portfolios/${OK}/scenarios/${id}`, "scenarioId"],
  ["patch", (id) => `/api/v1/portfolios/${OK}/scenarios/${id}`, "scenarioId"],
  ["delete", (id) => `/api/v1/portfolios/${OK}/scenarios/${id}`, "scenarioId"],
  ["post", (id) => `/api/v1/portfolios/${OK}/scenarios/${id}/archive`, "scenarioId"],
  ["post", (id) => `/api/v1/portfolios/${OK}/scenarios/${id}/calculate`, "scenarioId"],
];

describe("route parameter validation", () => {
  const app = createApp();
  const userIds: string[] = [];
  let token: string;

  beforeAll(async () => {
    const user = await createTestUser();
    userIds.push(user.user.id);
    token = tokenFor(user.user.id);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  it.each(routes)("%s %#: malformed id is 400 with a field detail", async (method, url, field) => {
    const response = await request(app)
      [method](url(BAD))
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(400);
    const error = body<ErrorEnvelope>(response).error;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.map((d) => d.field)).toEqual([field]);
  });

  it("authentication still runs before parameter validation", async () => {
    const response = await request(app).get(`/api/v1/portfolios/${BAD}`);
    expect(response.status).toBe(401);
  });

  it("a well-formed unknown id is still 404", async () => {
    const response = await request(app)
      .get(`/api/v1/portfolios/${OK}`)
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
