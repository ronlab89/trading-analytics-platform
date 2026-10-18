import { afterAll, beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestNotification,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

interface PortfolioDto {
  id: string;
  name: string;
  status: string;
}

interface PreferenceDto {
  theme: string;
}

/**
 * Integration tests for the VIEWER role.
 * Source: 09-security-spec.md §12-13 (ADR-005 points 2 and 13).
 *
 * A VIEWER reads its own resources, may update its own preferences and mark
 * its own notifications read, and mutates no domain data. The token's role
 * claim builds the `Actor`, so a VIEWER token is enough to act as one.
 */
describe("viewer role", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];
  let userId: string;
  let portfolioId: string;
  let assetId: string;
  let viewer: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    userId = user.id;
    userIds.push(userId);
    portfolioId = (await createTestPortfolio(userId, { name: "Viewer Portfolio" })).id;
    const asset = await createTestAsset("VWR");
    assetId = asset.id;
    assetIds.push(assetId);
    viewer = `Bearer ${tokenFor(userId, "VIEWER")}`;
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  it("reads its own portfolios", async () => {
    const response = await request(app).get("/api/v1/portfolios").set("Authorization", viewer);

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<PortfolioDto[]>>(response);
    expect(data.map((portfolio) => portfolio.id)).toContain(portfolioId);
  });

  it("is denied creating a portfolio with 403 and writes nothing", async () => {
    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", viewer)
      .send({ name: "Not allowed", baseCurrency: "USD" });

    expect(response.status).toBe(403);
    expect(body<ErrorEnvelope>(response).error.code).toBe("FORBIDDEN");

    const list = await request(app).get("/api/v1/portfolios").set("Authorization", viewer);
    expect(body<DataEnvelope<PortfolioDto[]>>(list).data).toHaveLength(1);
  });

  it("is denied updating its own portfolio with 403 and leaves it unchanged", async () => {
    const response = await request(app)
      .patch(`/api/v1/portfolios/${portfolioId}`)
      .set("Authorization", viewer)
      .send({ name: "Renamed" });

    expect(response.status).toBe(403);
    expect(body<ErrorEnvelope>(response).error.code).toBe("FORBIDDEN");

    const list = await request(app).get("/api/v1/portfolios").set("Authorization", viewer);
    expect(body<DataEnvelope<PortfolioDto[]>>(list).data[0]?.name).toBe("Viewer Portfolio");
  });

  it("is denied archiving its own portfolio with 403 and leaves it active", async () => {
    const response = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/archive`)
      .set("Authorization", viewer);

    expect(response.status).toBe(403);

    const list = await request(app).get("/api/v1/portfolios").set("Authorization", viewer);
    expect(body<DataEnvelope<PortfolioDto[]>>(list).data[0]?.status).toBe("ACTIVE");
  });

  it("is denied creating a transaction with 403 and records none", async () => {
    const response = await request(app)
      .post(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", viewer)
      .send({ assetId, type: "BUY", quantity: 10, price: { amount: "100", currency: "USD" } });

    expect(response.status).toBe(403);
    expect(body<ErrorEnvelope>(response).error.code).toBe("FORBIDDEN");

    const list = await request(app)
      .get(`/api/v1/portfolios/${portfolioId}/transactions`)
      .set("Authorization", viewer);
    expect(list.status).toBe(200);
    expect(body<DataEnvelope<unknown[]>>(list).data).toHaveLength(0);
  });

  it("may update its own preferences", async () => {
    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", viewer)
      .send({ theme: "dark" });

    expect(response.status).toBe(200);
    expect(body<DataEnvelope<PreferenceDto>>(response).data.theme).toBe("dark");
  });

  it("may mark its own notifications read, one and all", async () => {
    const first = await createTestNotification(userId);
    await createTestNotification(userId);

    const one = await request(app)
      .post(`/api/v1/notifications/${first.id}/read`)
      .set("Authorization", viewer);
    const all = await request(app)
      .post("/api/v1/notifications/read-all")
      .set("Authorization", viewer);

    expect(one.status).toBe(200);
    expect(all.status).toBe(204);
  });

  it("cannot escalate by claiming a higher role in a token it signed itself", async () => {
    const forged = jwt.sign({ sub: userId, role: "ADMIN" }, "x".repeat(40), { expiresIn: 60 });

    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${forged}`)
      .send({ name: "Escalated", baseCurrency: "USD" });

    expect(response.status).toBe(401);
    expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
  });
});
