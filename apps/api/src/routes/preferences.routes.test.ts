import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";
import { cleanupTestData, createTestPortfolio, createTestUser } from "../test-utils/fixtures.js";

interface PreferenceDto {
  userId: string;
  theme: string;
  language: string;
  defaultPortfolioId: string | null;
  reducedMotion: boolean;
  notificationPreferences: Record<string, unknown>;
}

/**
 * Integration tests for user preferences.
 * Source: 07-api-spec.md §29, 05-data-model.md §23 (created lazily on
 * first write), 09-security-spec.md §14-15.
 *
 * Preferences are a per-user singleton, so every test creates its own
 * user rather than sharing one: shared state would make the "no
 * preferences yet" tests order-dependent.
 */
describe("preferences", () => {
  const app = createApp();
  const userIds: string[] = [];

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  async function newUser(): Promise<{ id: string; token: string }> {
    const { user } = await createTestUser();
    userIds.push(user.id);
    return { id: user.id, token: tokenFor(user.id) };
  }

  it.each([
    ["get", "/api/v1/preferences"],
    ["patch", "/api/v1/preferences"],
  ] as const)("rejects unauthenticated %s %s with 401", async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(401);
    expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with null data when the user has never saved preferences", async () => {
    const { token } = await newUser();

    const response = await request(app)
      .get("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(body<DataEnvelope<PreferenceDto | null>>(response).data).toBeNull();
  });

  it("creates preferences on the first PATCH, filling omitted fields with schema defaults", async () => {
    const { id, token } = await newUser();

    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ reducedMotion: true });

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<PreferenceDto>>(response);
    expect(data.userId).toBe(id);
    expect(data.reducedMotion).toBe(true);
    expect(data.theme).toBe("system");
    expect(data.language).toBe("en");
    expect(data.defaultPortfolioId).toBeNull();
  });

  it("returns the saved preferences on a subsequent GET", async () => {
    const { token } = await newUser();
    await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ theme: "dark", language: "es" });

    const response = await request(app)
      .get("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const data = body<DataEnvelope<PreferenceDto>>(response).data;
    expect(data.theme).toBe("dark");
    expect(data.language).toBe("es");
  });

  it("applies partial updates without touching fields that were not sent", async () => {
    const { token } = await newUser();
    await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ theme: "dark", notificationPreferences: { email: false } });

    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ reducedMotion: true });

    const { data } = body<DataEnvelope<PreferenceDto>>(response);
    expect(data.reducedMotion).toBe(true);
    expect(data.theme).toBe("dark");
    expect(data.notificationPreferences).toEqual({ email: false });
  });

  it("does not expose one user's preferences to another", async () => {
    const writer = await newUser();
    const reader = await newUser();
    await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${writer.token}`)
      .send({ theme: "dark" });

    const response = await request(app)
      .get("/api/v1/preferences")
      .set("Authorization", `Bearer ${reader.token}`);

    expect(body<DataEnvelope<PreferenceDto | null>>(response).data).toBeNull();
  });

  it("rejects an update with no fields (400)", async () => {
    const { token } = await newUser();

    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an empty theme (400, field-level detail)", async () => {
    const { token } = await newUser();

    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ theme: "" });

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.details?.some((d) => d.field === "theme")).toBe(
      true,
    );
  });

  it("sets defaultPortfolioId to a portfolio the caller owns, and clears it with null", async () => {
    const { id, token } = await newUser();
    const portfolio = await createTestPortfolio(id);

    const set = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultPortfolioId: portfolio.id });
    expect(set.status).toBe(200);
    expect(body<DataEnvelope<PreferenceDto>>(set).data.defaultPortfolioId).toBe(portfolio.id);

    const cleared = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ defaultPortfolioId: null });
    expect(cleared.status).toBe(200);
    expect(body<DataEnvelope<PreferenceDto>>(cleared).data.defaultPortfolioId).toBeNull();
  });

  it("returns 404 when defaultPortfolioId points at another user's portfolio", async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const portfolio = await createTestPortfolio(owner.id);

    const response = await request(app)
      .patch("/api/v1/preferences")
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ defaultPortfolioId: portfolio.id });

    expect(response.status).toBe(404);
    expect(body<ErrorEnvelope>(response).error.code).toBe("NOT_FOUND");
  });
});
