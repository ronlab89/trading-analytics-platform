import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import {
  cleanupTestData,
  createTestAsset,
  createTestPortfolio,
  createTestUser,
} from "../test-utils/fixtures.js";

interface AlertDto {
  id: string;
  userId: string;
  assetId: string | null;
  portfolioId: string | null;
  type: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

/**
 * Integration tests for alerts.
 * Source: FR-053, 07-api-spec.md §27, 09-security-spec.md §14-15
 * (resource ownership: cross-user access is 404, never 403).
 */
describe("alerts", () => {
  const app = createApp();
  const userIds: string[] = [];
  const assetIds: string[] = [];

  let ownerId: string;
  let ownerToken: string;
  let otherId: string;
  let otherToken: string;

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);

    ownerId = owner.user.id;
    otherId = other.user.id;
    ownerToken = tokenFor(ownerId);
    otherToken = tokenFor(otherId);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds, assetIds });
  });

  async function newAssetId(): Promise<string> {
    const asset = await createTestAsset("AL");
    assetIds.push(asset.id);
    return asset.id;
  }

  /** Creates an alert through the API as the owner and returns its DTO. */
  async function createOwnerAlert(overrides: Record<string, unknown> = {}): Promise<AlertDto> {
    const assetId = await newAssetId();
    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId, type: "PRICE", condition: "ABOVE", threshold: 200, ...overrides });

    expect(response.status).toBe(201);
    return body<DataEnvelope<AlertDto>>(response).data;
  }

  it.each([
    ["get", "/api/v1/alerts"],
    ["get", "/api/v1/alerts/some-alert-id"],
    ["post", "/api/v1/alerts"],
    ["patch", "/api/v1/alerts/some-alert-id"],
    ["delete", "/api/v1/alerts/some-alert-id"],
  ] as const)("rejects unauthenticated %s %s with 401", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
    expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
  });

  it("creates an asset alert owned by the caller, enabled by default", async () => {
    const alert = await createOwnerAlert();

    expect(alert.userId).toBe(ownerId);
    expect(alert.type).toBe("PRICE");
    expect(alert.enabled).toBe(true);
    expect(alert.portfolioId).toBeNull();
  });

  it("creates a portfolio alert for a portfolio the caller owns", async () => {
    const portfolio = await createTestPortfolio(ownerId);

    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        portfolioId: portfolio.id,
        type: "PORTFOLIO_CHANGE",
        condition: "BELOW",
        threshold: -5,
        enabled: false,
      });

    expect(response.status).toBe(201);
    const { data } = body<DataEnvelope<AlertDto>>(response);
    expect(data.portfolioId).toBe(portfolio.id);
    expect(data.enabled).toBe(false);
  });

  it("rejects an alert that references neither an asset nor a portfolio (400)", async () => {
    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ type: "PRICE", condition: "ABOVE", threshold: 100 });

    expect(response.status).toBe(400);
    const { error } = body<ErrorEnvelope>(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.some((d) => d.field === "assetId")).toBe(true);
  });

  it("rejects an unknown alert type (400)", async () => {
    const assetId = await newAssetId();

    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assetId, type: "NOT_A_TYPE", condition: "ABOVE", threshold: 100 });

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.details?.some((d) => d.field === "type")).toBe(true);
  });

  it("returns 404 when the referenced asset does not exist", async () => {
    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        assetId: "asset-that-does-not-exist",
        type: "PRICE",
        condition: "ABOVE",
        threshold: 100,
      });

    expect(response.status).toBe(404);
  });

  it("returns 404 when the referenced portfolio belongs to another user", async () => {
    const othersPortfolio = await createTestPortfolio(otherId);

    const response = await request(app)
      .post("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        portfolioId: othersPortfolio.id,
        type: "PORTFOLIO_CHANGE",
        condition: "BELOW",
        threshold: -5,
      });

    expect(response.status).toBe(404);
  });

  it("only lists the caller's own alerts", async () => {
    const alert = await createOwnerAlert();

    const asOwner = await request(app)
      .get("/api/v1/alerts")
      .set("Authorization", `Bearer ${ownerToken}`);
    const asOther = await request(app)
      .get("/api/v1/alerts")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(body<DataEnvelope<AlertDto[]>>(asOwner).data.some((a) => a.id === alert.id)).toBe(true);
    expect(body<DataEnvelope<AlertDto[]>>(asOther).data.some((a) => a.id === alert.id)).toBe(false);
  });

  it("returns 404 (never 403) when another user requests the alert by id", async () => {
    const alert = await createOwnerAlert();

    const asOwner = await request(app)
      .get(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const asOther = await request(app)
      .get(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(asOwner.status).toBe(200);
    expect(asOther.status).toBe(404);
    expect(body<ErrorEnvelope>(asOther).error.code).toBe("NOT_FOUND");
  });

  it("updates condition, threshold and enabled", async () => {
    const alert = await createOwnerAlert();

    const response = await request(app)
      .patch(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ threshold: 250, enabled: false });

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<AlertDto>>(response);
    expect(data.threshold).toBe(250);
    expect(data.enabled).toBe(false);
    // Fields not sent stay untouched.
    expect(data.condition).toBe("ABOVE");
  });

  it("rejects an update with no fields (400)", async () => {
    const alert = await createOwnerAlert();

    const response = await request(app)
      .patch(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("cannot update another user's alert (404, alert unchanged)", async () => {
    const alert = await createOwnerAlert();

    const attempt = await request(app)
      .patch(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ threshold: 1 });
    expect(attempt.status).toBe(404);

    const after = await request(app)
      .get(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(body<DataEnvelope<AlertDto>>(after).data.threshold).toBe(200);
  });

  it("deletes an alert, after which it is gone", async () => {
    const alert = await createOwnerAlert();

    const deleted = await request(app)
      .delete(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const after = await request(app)
      .get(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(deleted.status).toBe(204);
    expect(after.status).toBe(404);
  });

  it("cannot delete another user's alert (404, alert still exists)", async () => {
    const alert = await createOwnerAlert();

    const attempt = await request(app)
      .delete(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(attempt.status).toBe(404);

    const after = await request(app)
      .get(`/api/v1/alerts/${alert.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(after.status).toBe(200);
  });
});
