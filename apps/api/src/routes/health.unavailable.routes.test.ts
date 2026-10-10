import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
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
  const app = createApp();
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
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

  it("logs one JSON line via console.error without secrets", async () => {
    await request(app).get("/health/ready");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0]?.[0]);
    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      parsed = undefined;
    }
    expect(parsed).toBeDefined();
    expect(parsed).toMatchObject({
      level: "error",
      event: "health.database.unavailable",
      errorName: "Error",
    });
    expect(typeof parsed?.requestId).toBe("string");
    expect(line).not.toContain("s3cret");
    expect(line).not.toContain("postgres://");
    expect(line).not.toContain("ECONNREFUSED");
  });
});
