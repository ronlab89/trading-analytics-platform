import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { createApp } from "../app.js";
import { tokenFor } from "../test-utils/auth.js";
import { cleanupTestData, createTestUser } from "../test-utils/fixtures.js";

/**
 * `authz.denied` through the full app (ADR-009 point 9): a VIEWER acting as a
 * TRADER is refused with 403 and the log says who, with which role, and which
 * permission was missing.
 */
describe("authz.denied", () => {
  const userIds: string[] = [];
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const { user } = await createTestUser();
    userId = user.id;
    userIds.push(userId);
    token = tokenFor(userId, "VIEWER");
  });

  afterAll(async () => {
    await cleanupTestData({ userIds });
  });

  const deniedEntries = (logger: ReturnType<typeof capturingLogger>) =>
    logger.entries.filter((entry) => entry.event === "authz.denied");

  it("logs the user, the role and the missing permission when a VIEWER is refused", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });

    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Not allowed", baseCurrency: "USD" });

    expect(response.status).toBe(403);
    const entries = deniedEntries(logger);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "warn",
      event: "authz.denied",
      fields: { userId, role: "VIEWER", permission: "portfolio:write" },
    });
    expect(entries[0]?.fields.requestId).toBe(response.headers["x-request-id"]);
  });

  it("leaves the access token and the Authorization header out of the entry", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });

    await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Not allowed", baseCurrency: "USD" });

    expect(JSON.stringify(deniedEntries(logger))).not.toContain(token);
  });

  it("logs nothing when the role has the permission", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });

    const response = await request(app)
      .get("/api/v1/portfolios")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(deniedEntries(logger)).toEqual([]);
  });
});
