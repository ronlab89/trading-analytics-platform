import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { createApp } from "../app.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * Logout security event (ADR-009 point 9): `auth.logout` at info with the
 * userId only, and only when a live session was actually ended.
 */
describe("logout events", () => {
  const HEADER = { "X-Requested-With": "XMLHttpRequest" } as const;
  const userIds: string[] = [];

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  async function startSession(app: ReturnType<typeof createApp>) {
    const { user, password } = await createTestUser();
    userIds.push(user.id);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });
    const cookies = login.headers["set-cookie"] as unknown as string[];
    const refreshToken = /^refresh_token=([^;]+)/.exec(cookies[0] ?? "")?.[1] ?? "";
    return { user, refreshToken };
  }

  const logoutEntries = (logger: ReturnType<typeof capturingLogger>) =>
    logger.entries.filter((entry) => entry.event === "auth.logout");

  it("logs auth.logout at info with the userId and nothing else", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { user, refreshToken } = await startSession(app);

    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set(HEADER)
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(response.status).toBe(204);
    const entries = logoutEntries(logger);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe("info");
    const { requestId: _requestId, ...fields } = entries[0]?.fields ?? {};
    expect(fields).toEqual({ userId: user.id });
  });

  it("leaves the refresh token and the cookie out of the entry", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { refreshToken } = await startSession(app);

    await request(app)
      .post("/api/v1/auth/logout")
      .set(HEADER)
      .set("Cookie", `refresh_token=${refreshToken}`);

    expect(refreshToken).not.toBe("");
    expect(JSON.stringify(logoutEntries(logger))).not.toContain(refreshToken);
  });

  it("logs nothing when there was no live session to end", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { refreshToken } = await startSession(app);
    const logout = () =>
      request(app)
        .post("/api/v1/auth/logout")
        .set(HEADER)
        .set("Cookie", `refresh_token=${refreshToken}`);

    await logout();
    const repeated = await logout();
    const withoutCookie = await request(app).post("/api/v1/auth/logout").set(HEADER);

    expect(repeated.status).toBe(204);
    expect(withoutCookie.status).toBe(204);
    expect(logoutEntries(logger)).toHaveLength(1);
  });
});
