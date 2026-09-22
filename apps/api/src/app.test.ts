import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

/**
 * Smoke test for `createApp()` itself: confirms the app wiring works
 * end-to-end through supertest before the fuller integration suite
 * (auth, ownership, validation, rollback) is added on top of it.
 */
describe("createApp", () => {
  it("responds on the root route", async () => {
    const app = createApp();
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ service: "trading-api", status: "ok" });
  });

  it("returns a normalized 404 for an unknown route", async () => {
    const app = createApp();
    const response = await request(app).get("/does-not-exist");

    const body = response.body as { error: { code: string; requestId: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeDefined();
  });
});
