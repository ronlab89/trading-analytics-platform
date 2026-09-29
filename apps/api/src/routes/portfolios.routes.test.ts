import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import {
  body,
  type DataEnvelope,
  type DataMetaEnvelope,
  type ErrorEnvelope,
} from "../test-utils/api-client.js";
import { cleanupTestData, createTestPortfolio, createTestUser } from "../test-utils/fixtures.js";

interface PortfolioDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  status: string;
}

/** Signs a token the same way auth.service.ts does, bypassing HTTP login. */
function tokenFor(userId: string, role = "USER"): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}

/**
 * Integration tests for portfolio ownership and CRUD.
 * Source: FR-008/009/010/011, 09-security-spec.md §14-15 (Resource
 * Ownership / IDOR Protection — cross-user access must be 404, never 403).
 */
describe("portfolios", () => {
  const app = createApp();
  const userIds: string[] = [];

  let ownerId: string;
  let ownerToken: string;
  let otherToken: string;

  beforeAll(async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    userIds.push(owner.user.id, other.user.id);

    ownerId = owner.user.id;
    ownerToken = tokenFor(owner.user.id);
    otherToken = tokenFor(other.user.id);
  });

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  it("creates a portfolio owned by the authenticated caller", async () => {
    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "My Portfolio", baseCurrency: "USD" });

    expect(response.status).toBe(201);
    const { data } = body<DataEnvelope<PortfolioDto>>(response);
    expect(data.userId).toBe(ownerId);
    expect(data.status).toBe("ACTIVE");
  });

  it("rejects portfolio creation with an invalid body (400, field-level detail)", async () => {
    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "", baseCurrency: "US" });

    expect(response.status).toBe(400);
    const { error } = body<ErrorEnvelope>(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details?.some((d) => d.field === "name")).toBe(true);
    expect(error.details?.some((d) => d.field === "baseCurrency")).toBe(true);
  });

  it("only lists portfolios owned by the caller", async () => {
    const portfolio = await createTestPortfolio(ownerId, { name: "Owner Only" });

    const asOwner = await request(app)
      .get("/api/v1/portfolios")
      .set("Authorization", `Bearer ${ownerToken}`);
    const asOther = await request(app)
      .get("/api/v1/portfolios")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(
      body<DataEnvelope<PortfolioDto[]>>(asOwner).data.some((p) => p.id === portfolio.id),
    ).toBe(true);
    expect(
      body<DataEnvelope<PortfolioDto[]>>(asOther).data.some((p) => p.id === portfolio.id),
    ).toBe(false);
  });

  it("returns 404 (never 403) when another user requests the portfolio by id", async () => {
    const portfolio = await createTestPortfolio(ownerId);

    const asOwner = await request(app)
      .get(`/api/v1/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const asOther = await request(app)
      .get(`/api/v1/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(asOwner.status).toBe(200);
    expect(asOther.status).toBe(404);
    expect(body<ErrorEnvelope>(asOther).error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a syntactically valid but nonexistent portfolio id", async () => {
    const response = await request(app)
      .get("/api/v1/portfolios/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(404);
  });

  it("updates name/description but never baseCurrency", async () => {
    const portfolio = await createTestPortfolio(ownerId, { baseCurrency: "USD" });

    const response = await request(app)
      .patch(`/api/v1/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Renamed", description: "Updated" });

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<PortfolioDto>>(response);
    expect(data.name).toBe("Renamed");
    expect(data.baseCurrency).toBe("USD");
  });

  it("rejects an update attempt against another user's portfolio (404)", async () => {
    const portfolio = await createTestPortfolio(ownerId);

    const response = await request(app)
      .patch(`/api/v1/portfolios/${portfolio.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });

  it("archives idempotently, reporting alreadyArchived on the second call", async () => {
    const portfolio = await createTestPortfolio(ownerId);

    const first = await request(app)
      .post(`/api/v1/portfolios/${portfolio.id}/archive`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const second = await request(app)
      .post(`/api/v1/portfolios/${portfolio.id}/archive`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(first.status).toBe(200);
    expect(body<DataMetaEnvelope<PortfolioDto, { alreadyArchived: boolean }>>(first).meta).toEqual({
      alreadyArchived: false,
    });
    expect(body<DataMetaEnvelope<PortfolioDto, { alreadyArchived: boolean }>>(second).meta).toEqual(
      {
        alreadyArchived: true,
      },
    );
  });
});
