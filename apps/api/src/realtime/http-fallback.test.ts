import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

/**
 * With the socket down every screen keeps its data through HTTP (spec 08
 * §29, NFR-014). The app is built here with no WebSocket server at all, so
 * a route that answered only through the socket could not be mounted.
 */
const SCREEN_ENDPOINTS = [
  "/api/v1/portfolios",
  "/api/v1/portfolios/p1/overview",
  "/api/v1/portfolios/p1/positions",
  "/api/v1/portfolios/p1/analytics/performance",
  "/api/v1/portfolios/p1/decisions",
  "/api/v1/market/prices",
  "/api/v1/watchlist",
  "/api/v1/alerts",
  "/api/v1/notifications",
  "/api/v1/jobs/j1",
];

describe("HTTP without the realtime layer", () => {
  it.each(SCREEN_ENDPOINTS)("%s is mounted and asks for authentication", async (path) => {
    const response = await request(createApp()).get(path);

    expect(response.status).toBe(401);
  });

  it("does not import the realtime layer into the HTTP app", () => {
    const source = readFileSync(new URL("../app.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/realtime/i);
  });
});
