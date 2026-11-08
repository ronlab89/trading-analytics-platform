import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body } from "../test-utils/api-client.js";
import { checkDatabaseConnection } from "../services/health.service.js";

vi.mock("../services/health.service.js", () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(undefined),
}));

describe("health endpoints while shutting down (ADR-006 point 12)", () => {
  beforeEach(() => {
    vi.mocked(checkDatabaseConnection).mockClear();
  });

  it("answers GET /health/ready with 503, status unavailable and no checks", async () => {
    const app = createApp({ isShuttingDown: () => true });

    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    const data = body<Record<string, unknown>>(response);
    expect(data).toEqual({
      status: "unavailable",
      service: "trading-api",
      timestamp: expect.any(String) as string,
    });
    expect(new Date(data.timestamp as string).toISOString()).toBe(data.timestamp);
    expect(data).not.toHaveProperty("checks");
  });

  it("does not query the database while shutting down", async () => {
    const app = createApp({ isShuttingDown: () => true });

    await request(app).get("/health/ready");

    expect(checkDatabaseConnection).not.toHaveBeenCalled();
  });

  it("keeps GET /health alive: the process is still running", async () => {
    const app = createApp({ isShuttingDown: () => true });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(body<{ status: string }>(response).status).toBe("ok");
  });

  it("follows the flag: ready before the signal, 503 after it", async () => {
    let shuttingDown = false;
    const app = createApp({ isShuttingDown: () => shuttingDown });

    const before = await request(app).get("/health/ready");
    shuttingDown = true;
    const after = await request(app).get("/health/ready");

    expect(before.status).toBe(200);
    expect(body<{ checks: unknown }>(before).checks).toEqual({ database: "ok" });
    expect(after.status).toBe(503);
  });

  it("answers as before when no flag is given", async () => {
    const response = await request(createApp()).get("/health/ready");

    expect(response.status).toBe(200);
    expect(checkDatabaseConnection).toHaveBeenCalledTimes(1);
  });
});
