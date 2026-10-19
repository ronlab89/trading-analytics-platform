import { describe, expect, it } from "vitest";
import request from "supertest";
import { silentLogger } from "@trading/application";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

describe("CORS exposed headers", () => {
  const origin = env.CORS_ORIGIN[0] ?? "";
  const app = createApp({ logger: silentLogger });

  it("exposes X-Request-ID to the web origin", async () => {
    const response = await request(app).get("/").set("Origin", origin);

    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-expose-headers"]).toMatch(/x-request-id/i);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("sends no CORS headers to an origin that is not allowed", async () => {
    const response = await request(app).get("/").set("Origin", "https://evil.example.com");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-expose-headers"]).toBeUndefined();
  });
});
