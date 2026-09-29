import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { body, type ErrorEnvelope } from "../test-utils/api-client.js";

/**
 * Integration tests for the request-body/JSON parsing boundary itself
 * (not schema validation, covered per-route by portfolios/transactions
 * tests). Source: 09-security-spec.md §27 (request size limits),
 * error-handler.ts's body-parser error mapping.
 *
 * No database fixtures needed: a valid JWT is enough to reach the route
 * handler for the 100kb-limit case; the malformed-JSON case never gets
 * that far (it fails before the router runs at all).
 */
describe("request body validation", () => {
  const app = createApp();

  it("returns 400 (not 500) for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "broken"');

    expect(response.status).toBe(400);
    expect(body<ErrorEnvelope>(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 413 for a body over the configured size limit", async () => {
    const token = jwt.sign({ sub: "irrelevant-user-id", role: "USER" }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    });

    const response = await request(app)
      .post("/api/v1/portfolios")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "x".repeat(200_000), baseCurrency: "USD" });

    expect(response.status).toBe(413);
  });
});
