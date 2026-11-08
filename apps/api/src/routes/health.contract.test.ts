import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  livenessResponseSchema,
  readinessResponseSchema,
  serviceInfoResponseSchema,
} from "@trading/contracts";
import { createApp } from "../app.js";
import { checkDatabaseConnection } from "../services/health.service.js";

vi.mock("../services/health.service.js", () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(undefined),
}));

/**
 * The service endpoints answer without the `{ data }` envelope, so the
 * OpenAPI document describes them with their own schemas. Every answer is
 * validated against them here, so the document cannot drift from the code.
 */
describe("the service endpoints against their contract", () => {
  beforeEach(() => {
    vi.mocked(checkDatabaseConnection).mockReset().mockResolvedValue(undefined);
  });

  it("GET / answers the service info", async () => {
    const response = await request(createApp()).get("/");

    expect(response.status).toBe(200);
    expect(serviceInfoResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("GET /health answers the liveness body", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(livenessResponseSchema.safeParse(response.body).success).toBe(true);
  });

  it("GET /health/ready answers 200 with the database check", async () => {
    const response = await request(createApp()).get("/health/ready");

    expect(response.status).toBe(200);
    expect(readinessResponseSchema.parse(response.body).checks).toEqual({ database: "ok" });
  });

  it("GET /health/ready answers 503 with the database check when the database is down", async () => {
    vi.mocked(checkDatabaseConnection).mockRejectedValue(new Error("down"));

    const response = await request(createApp()).get("/health/ready");

    expect(response.status).toBe(503);
    expect(readinessResponseSchema.parse(response.body)).toMatchObject({
      status: "unavailable",
      checks: { database: "unavailable" },
    });
  });

  it("GET /health/ready answers 503 with no checks while shutting down", async () => {
    const response = await request(createApp({ isShuttingDown: () => true })).get("/health/ready");

    expect(response.status).toBe(503);
    expect(readinessResponseSchema.parse(response.body).checks).toBeUndefined();
  });
});
