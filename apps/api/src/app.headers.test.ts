import { describe, expect, it } from "vitest";
import request from "supertest";
import { silentLogger } from "@trading/application";
import { createApp } from "./app.js";

// 09-security-spec.md and 15-implementation-plan.md §33: the headers come from `helmet()`, and a
// response must carry them whatever its status, so an error answer is covered too.
describe("security headers", () => {
  const app = createApp({ logger: silentLogger });

  it.each([
    { name: "a health answer (200)", path: "/health", status: 200 },
    { name: "an unknown route (404)", path: "/api/v1/does-not-exist", status: 404 },
    { name: "an unauthenticated request (401)", path: "/api/v1/portfolios", status: 401 },
  ])("sets them on $name", async ({ path, status }) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(status);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
  });

  it("does not reveal the framework", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
