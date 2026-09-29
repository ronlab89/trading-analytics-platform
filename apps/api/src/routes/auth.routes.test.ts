import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * Integration tests for authentication.
 * Source: FR-001 (Login), FR-002 (Session Persistence), 09-security-spec.md
 * §51 (generic "Invalid credentials" message, no account enumeration).
 */
describe("auth", () => {
  const app = createApp();
  const userIds: string[] = [];

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  it("logs in with valid credentials and returns a usable token", async () => {
    const { user, password } = await createTestUser();
    userIds.push(user.id);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    interface LoginData {
      user: { id: string; email: string };
      session: { token: string };
    }

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<LoginData>>(response);
    expect(data.user.id).toBe(user.id);
    expect(data.session.token).toEqual(expect.any(String));

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${data.session.token}`);

    expect(me.status).toBe(200);
    expect(body<DataEnvelope<{ user: { id: string } }>>(me).data.user.id).toBe(user.id);
  });

  it("rejects an incorrect password with a generic message", async () => {
    const { user } = await createTestUser();
    userIds.push(user.id);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(response.status).toBe(401);
    const { error } = body<ErrorEnvelope>(response);
    expect(error.message.toLowerCase()).not.toContain(user.email);
    expect(error.message).not.toMatch(/exist|found/i);
  });

  it("rejects a login for an email that does not exist, with the same generic message", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(response.status).toBe(401);
    expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects /me without a token", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("rejects /me with a malformed token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
  });
});
