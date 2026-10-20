import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { capturingLogger, type CapturingLogger } from "@trading/application";
import { createApp } from "../app.js";
import { body } from "../test-utils/api-client.js";

vi.mock("../services/health.service.js", () => ({
  checkDatabaseConnection: vi
    .fn()
    .mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://user:s3cret@db.internal:5432/trading"),
    ),
}));

interface UnavailableBody {
  status: string;
  service: string;
  timestamp: string;
  checks: { database: string };
}

/**
 * Characterization of the 503 branch of GET /health/ready (B0.3 T5). The
 * database check is mocked to reject; the success path is covered against
 * the real database in health.routes.test.ts.
 */
describe("GET /health/ready (database unavailable)", () => {
  let logger: CapturingLogger;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    logger = capturingLogger();
    app = createApp({ logger });
  });

  it("returns 503 with the exact unavailable body", async () => {
    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    const data = body<UnavailableBody>(response);
    expect(data).toEqual({
      status: "unavailable",
      service: "trading-api",
      timestamp: expect.any(String) as string,
      checks: { database: "unavailable" },
    });
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  it("does not leak the driver error or credentials in the body", async () => {
    const response = await request(app).get("/health/ready");

    const raw = response.text;
    expect(raw).not.toContain("ECONNREFUSED");
    expect(raw).not.toContain("s3cret");
    expect(raw).not.toContain("postgres://");
    expect(response.body).not.toHaveProperty("requestId");
    expect(response.body).not.toHaveProperty("error");
  });

  it("logs one health.database.unavailable entry at error without secrets", async () => {
    await request(app).get("/health/ready");

    const unavailable = logger.entries.filter(
      (entry) => entry.event === "health.database.unavailable",
    );
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]).toMatchObject({
      level: "error",
      fields: { errorName: "Error" },
    });
    expect(typeof unavailable[0]?.fields.requestId).toBe("string");
    const line = JSON.stringify(logger.entries);
    expect(line).not.toContain("s3cret");
    expect(line).not.toContain("postgres://");
    expect(line).not.toContain("ECONNREFUSED");
  });
});
