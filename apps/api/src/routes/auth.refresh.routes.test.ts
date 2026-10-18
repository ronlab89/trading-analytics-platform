import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { PrismaSessionRepository } from "@trading/database";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { hashRefreshToken } from "../services/refresh-token.js";
import { body, type DataEnvelope, type ErrorEnvelope } from "../test-utils/api-client.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * Integration tests for refresh and logout.
 * Source: FR-003, ADR-005 points 5-7, 09-security-spec.md §7-9.
 *
 * Time is moved with fake `Date` only (the grace window is 10 seconds), so
 * nothing waits; the HTTP stack keeps its real timers.
 */
interface SessionData {
  user: { id: string; role: string };
  session: { accessToken: string; expiresAt: string };
}

const HEADER = { "X-Requested-With": "XMLHttpRequest" } as const;

describe("auth refresh and logout", () => {
  const app = createApp();
  const sessions = new PrismaSessionRepository();
  const userIds: string[] = [];

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  const setCookiesOf = (response: request.Response): string[] =>
    (response.headers["set-cookie"] as unknown as string[] | undefined) ?? [];

  const refreshCookieOf = (response: request.Response): string | undefined =>
    setCookiesOf(response).find((value) => value.startsWith("refresh_token="));

  const tokenOf = (response: request.Response): string =>
    /^refresh_token=([^;]*)/.exec(refreshCookieOf(response) ?? "")?.[1] ?? "";

  /** A fresh user logged in; returns the refresh token of the new session. */
  const login = async () => {
    const { user, password } = await createTestUser();
    userIds.push(user.id);
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    const { data } = body<DataEnvelope<SessionData>>(response);

    return { user, token: tokenOf(response), accessToken: data.session.accessToken };
  };

  const refresh = (token: string) =>
    request(app).post("/api/v1/auth/refresh").set(HEADER).set("Cookie", `refresh_token=${token}`);

  const logout = (token: string) =>
    request(app).post("/api/v1/auth/logout").set(HEADER).set("Cookie", `refresh_token=${token}`);

  describe("POST /auth/refresh", () => {
    it("rotates the token: login-shaped body, a new cookie, and the old token marked rotated", async () => {
      const { user, token } = await login();

      const response = await refresh(token);

      expect(response.status).toBe(200);
      const { data } = body<DataEnvelope<SessionData>>(response);
      expect(data.user).toMatchObject({ id: user.id, role: "TRADER" });
      expect(Object.keys(data.session).sort()).toEqual(["accessToken", "expiresAt"]);
      const next = tokenOf(response);
      expect(next).not.toBe("");
      expect(next).not.toBe(token);
      expect(response.text).not.toContain(next);
      expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.rotatedAt).not.toBeNull();
      expect((await sessions.getByTokenHash(hashRefreshToken(next)))?.rotatedAt).toBeNull();
    });

    it("issues an access token that works on a protected route", async () => {
      const { user, token } = await login();

      const { data } = body<DataEnvelope<SessionData>>(await refresh(token));
      const me = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${data.session.accessToken}`);

      expect(me.status).toBe(200);
      expect(body<DataEnvelope<{ user: { id: string } }>>(me).data.user.id).toBe(user.id);
    });

    it("sets the rotated cookie with the same flags as login", async () => {
      const { token } = await login();

      const cookie = refreshCookieOf(await refresh(token));

      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Strict");
      expect(cookie).toContain("Path=/api/v1/auth");
      expect(cookie).toContain("Max-Age=2592000");
    });

    it("rejects a request without the custom header, and revokes and rotates nothing", async () => {
      const { token } = await login();

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", `refresh_token=${token}`);

      expect(response.status).toBe(403);
      expect(body<ErrorEnvelope>(response).error.code).toBe("FORBIDDEN");
      expect(response.headers["set-cookie"]).toBeUndefined();
      const stored = await sessions.getByTokenHash(hashRefreshToken(token));
      expect(stored).toMatchObject({ rotatedAt: null, revokedAt: null });
      expect((await refresh(token)).status).toBe(200);
    });

    it("rejects a missing cookie with a 401 and clears the cookie", async () => {
      const response = await request(app).post("/api/v1/auth/refresh").set(HEADER);

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.message).toBe("Invalid refresh token.");
      const cleared = refreshCookieOf(response);
      expect(cleared).toContain("Path=/api/v1/auth");
      expect(cleared).toMatch(/^refresh_token=;/);
      expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
    });

    it("rejects an unknown token with the same 401", async () => {
      const response = await refresh("not-a-real-token");

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.message).toBe("Invalid refresh token.");
    });

    it("answers a retry inside the grace window with the same refresh token (lost first response)", async () => {
      const { token } = await login();
      const first = await refresh(token);

      const retry = await refresh(token);

      expect(retry.status).toBe(200);
      expect(tokenOf(retry)).toBe(tokenOf(first));
    });

    it("gives two parallel refreshes the same refresh token and rotates once", async () => {
      const { token } = await login();

      const [a, b] = await Promise.all([refresh(token), refresh(token)]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(tokenOf(a)).toBe(tokenOf(b));
      expect((await sessions.getByTokenHash(hashRefreshToken(tokenOf(a))))?.rotatedAt).toBeNull();
    });

    it("treats a rotated token used after the window as reuse and revokes the whole family", async () => {
      const { token } = await login();
      const next = tokenOf(await refresh(token));
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 11 * 1000);

      const reuse = await refresh(token);

      expect(reuse.status).toBe(401);
      expect((await sessions.getByTokenHash(hashRefreshToken(next)))?.revokedAt).not.toBeNull();
      expect((await refresh(next)).status).toBe(401);
    });

    it("rejects a token idle for longer than the idle timeout", async () => {
      const { token } = await login();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + (env.SESSION_IDLE_SECONDS + 1) * 1000);

      expect((await refresh(token)).status).toBe(401);
    });

    it("answers CORS preflight and allows credentials for the web origin", async () => {
      const origin = env.CORS_ORIGIN[0] ?? "";

      const response = await request(app)
        .options("/api/v1/auth/refresh")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "x-requested-with");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.headers["access-control-allow-headers"]).toMatch(/x-requested-with/i);
    });
  });

  describe("POST /auth/logout", () => {
    it("revokes the session, clears the cookie and answers 204", async () => {
      const { token } = await login();

      const response = await logout(token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      const cleared = refreshCookieOf(response);
      expect(cleared).toMatch(/^refresh_token=;/);
      expect(cleared).toContain("Path=/api/v1/auth");
      expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).not.toBeNull();
    });

    it("makes the refresh token stop working, including the ones it rotated into", async () => {
      const { token } = await login();
      const next = tokenOf(await refresh(token));

      await logout(next);

      expect((await refresh(next)).status).toBe(401);
      expect((await refresh(token)).status).toBe(401);
    });

    it("leaves an access token issued before logout valid until it expires", async () => {
      const { token, accessToken } = await login();

      await logout(token);
      const me = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(me.status).toBe(200);
    });

    it("rejects a request without the custom header and does not revoke the session", async () => {
      const { token } = await login();

      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", `refresh_token=${token}`);

      expect(response.status).toBe(403);
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).toBeNull();
      expect((await refresh(token)).status).toBe(200);
    });

    it("answers 204 and clears the cookie without a cookie, with an unknown token, and when repeated", async () => {
      const { token } = await login();
      await logout(token);

      const withoutCookie = await request(app).post("/api/v1/auth/logout").set(HEADER);
      const unknown = await logout("not-a-real-token");
      const repeated = await logout(token);

      for (const response of [withoutCookie, unknown, repeated]) {
        expect(response.status).toBe(204);
        expect(refreshCookieOf(response)).toMatch(/^refresh_token=;/);
      }
    });

    it("leaves the sessions of the same user in other families alive", async () => {
      const { user, token } = await login();
      const other = await sessions.create({
        userId: user.id,
        familyId: "other-family",
        tokenHash: hashRefreshToken("other-token"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await logout(token);

      expect(
        (await sessions.getByTokenHash(hashRefreshToken("other-token")))?.revokedAt,
      ).toBeNull();
      expect(other.revokedAt).toBeNull();
    });
  });
});
