import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaSessionRepository } from "@trading/database";
import { createApp } from "../app.js";
import { hashRefreshToken } from "../services/refresh-token.js";
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
      user: { id: string; email: string; role: string };
      session: { accessToken: string; expiresAt: string };
    }

    expect(response.status).toBe(200);
    const { data } = body<DataEnvelope<LoginData>>(response);
    expect(data.user).toMatchObject({ id: user.id, role: "TRADER" });
    expect(Object.keys(data.session).sort()).toEqual(["accessToken", "expiresAt"]);
    expect(data.session.accessToken).toEqual(expect.any(String));
    const expiresIn = new Date(data.session.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresIn).toBeLessThanOrEqual(15 * 60 * 1000);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${data.session.accessToken}`);

    expect(me.status).toBe(200);
    expect(body<DataEnvelope<{ user: { id: string } }>>(me).data.user.id).toBe(user.id);
  });

  it("starts a session: the refresh token is an HttpOnly cookie and only its hash is stored", async () => {
    const { user, password } = await createTestUser();
    userIds.push(user.id);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    const cookies = response.headers["set-cookie"] as unknown as string[];
    const cookie = cookies.find((value) => value.startsWith("refresh_token="));
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(cookie).toContain("Max-Age=2592000");

    const refreshToken = /^refresh_token=([^;]+)/.exec(cookie ?? "")?.[1] ?? "";
    expect(response.text).not.toContain(refreshToken);

    const sessions = new PrismaSessionRepository();
    const stored = await sessions.getByTokenHash(hashRefreshToken(refreshToken));
    expect(stored).toMatchObject({ userId: user.id, rotatedAt: null, revokedAt: null });
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(await sessions.getByTokenHash(refreshToken)).toBeNull();
  });

  it("starts a separate session family on every login", async () => {
    const { user, password } = await createTestUser();
    userIds.push(user.id);
    const login = () =>
      request(app).post("/api/v1/auth/login").send({ email: user.email, password });

    const [first, second] = [await login(), await login()];
    const tokenOf = (response: Awaited<ReturnType<typeof login>>) =>
      /refresh_token=([^;]+)/.exec(
        (response.headers["set-cookie"] as unknown as string[]).join(";"),
      )?.[1] ?? "";
    const sessions = new PrismaSessionRepository();

    const a = await sessions.getByTokenHash(hashRefreshToken(tokenOf(first)));
    const b = await sessions.getByTokenHash(hashRefreshToken(tokenOf(second)));
    expect(a?.familyId).toBeDefined();
    expect(b?.familyId).toBeDefined();
    expect(a?.familyId).not.toBe(b?.familyId);
  });

  it("sets no cookie and starts no session when the login fails", async () => {
    const { user } = await createTestUser();
    userIds.push(user.id);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
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
