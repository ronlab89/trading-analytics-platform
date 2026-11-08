import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { body, type ErrorEnvelope } from "../test-utils/api-client.js";

interface HealthBody {
  status: string;
  service: string;
  timestamp: string;
  checks?: { database: string };
}

/**
 * Characterization tests for GET /health and GET /health/ready (B0.3 T5).
 * They pin today's HTTP behavior so the layering refactor is provably
 * behavior-preserving. The 503 branch lives in
 * health.unavailable.routes.test.ts (it needs a mocked health service).
 */
describe("health routes", () => {
  const app = createApp();

  function expectFreshIso(timestamp: string): void {
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
    expect(Math.abs(Date.now() - new Date(timestamp).getTime())).toBeLessThan(10_000);
  }

  describe("GET /health", () => {
    it("returns 200 with the exact liveness body", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      const data = body<HealthBody>(response);
      expect(data).toEqual({
        status: "ok",
        service: "trading-api",
        timestamp: expect.any(String) as string,
      });
      expectFreshIso(data.timestamp);
    });

    it("needs no Authorization header", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
    });

    it("ignores an invalid bearer token (no auth applied)", async () => {
      const response = await request(app).get("/health").set("Authorization", "Bearer not-a-jwt");

      expect(response.status).toBe(200);
      expect(body<HealthBody>(response).status).toBe("ok");
    });

    it("still sets the x-request-id header", async () => {
      const response = await request(app).get("/health");

      expect(typeof response.headers["x-request-id"]).toBe("string");
    });

    it("returns 404 NOT_FOUND for POST /health (only GET is routed)", async () => {
      const response = await request(app).post("/health");

      expect(response.status).toBe(404);
      const data = body<ErrorEnvelope>(response);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toBe("Route not found: POST /health");
    });
  });

  describe("GET /health/ready (database reachable)", () => {
    it("returns 200 with the exact readiness body", async () => {
      const response = await request(app).get("/health/ready");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      const data = body<HealthBody>(response);
      expect(data).toEqual({
        status: "ok",
        service: "trading-api",
        timestamp: expect.any(String) as string,
        checks: { database: "ok" },
      });
      expectFreshIso(data.timestamp);
    });

    it("needs no Authorization header and ignores an invalid token", async () => {
      const anonymous = await request(app).get("/health/ready");
      const invalid = await request(app).get("/health/ready").set("Authorization", "Bearer nope");

      expect(anonymous.status).toBe(200);
      expect(invalid.status).toBe(200);
    });
  });
});
