import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { createApp } from "../app.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * Login security events (ADR-009 points 6 and 9; 09-security-spec.md §51):
 * failures carry the same entry whatever the cause, and no entry holds a secret.
 */
describe("login events", () => {
  const userIds: string[] = [];

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  function loginEntries(logger: ReturnType<typeof capturingLogger>) {
    return logger.entries.filter((entry) => entry.event.startsWith("auth.login."));
  }

  it("logs auth.login.succeeded at info with the userId", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { user, password } = await createTestUser();
    userIds.push(user.id);

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password });

    expect(response.status).toBe(200);
    const entries = loginEntries(logger);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      event: "auth.login.succeeded",
      fields: { userId: user.id },
    });
  });

  it("logs the same auth.login.failed entry for a wrong password and an unknown email", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { user } = await createTestUser();
    userIds.push(user.id);

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "not-the-password" });
    const unknownEmail = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "not-the-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const entries = loginEntries(logger);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.level).toBe("warn");
      expect(entry.event).toBe("auth.login.failed");
    }
    const [first, second] = entries;
    const withoutRequestId = (fields: Record<string, unknown> | undefined) => {
      const { requestId: _requestId, ...rest } = fields ?? {};
      return rest;
    };
    expect(withoutRequestId(first?.fields)).toEqual(withoutRequestId(second?.fields));
  });

  it("leaves the password, the tokens, the cookie and the email out of every login entry", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });
    const { user, password } = await createTestUser();
    userIds.push(user.id);

    const ok = await request(app)
      .post("/api/v1/auth/login")
      .set("Authorization", "Bearer should-never-be-logged")
      .send({ email: user.email, password });
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "not-the-password" });

    const cookies = ok.headers["set-cookie"] as unknown as string[];
    const refreshToken = /^refresh_token=([^;]+)/.exec(cookies[0] ?? "")?.[1] ?? "";
    const accessToken = (ok.body as { data: { session: { accessToken: string } } }).data.session
      .accessToken;
    const logged = JSON.stringify(loginEntries(logger));
    for (const secret of [
      password,
      "not-the-password",
      refreshToken,
      accessToken,
      "should-never-be-logged",
      user.email,
    ]) {
      expect(secret).not.toBe("");
      expect(logged).not.toContain(secret);
    }
  });
});
