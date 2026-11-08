import { describe, expect, it } from "vitest";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { createApp } from "./app.js";

function requestIdOf(response: request.Response): string {
  const id: unknown = response.headers["x-request-id"];
  if (typeof id !== "string") throw new Error("Missing X-Request-ID header");
  return id;
}

/**
 * Request correlation from the request to the log (ADR-009 points 5 and 13):
 * the full app runs with a capturing logger, as the `silent` default of the
 * test environment would hide every entry.
 */
describe("request logging through the full app", () => {
  it("writes the requestId of the response header on every entry of a request", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });

    const response = await request(app).get("/no-such-route");

    const id = requestIdOf(response);
    expect(response.status).toBe(404);
    expect(logger.entries.map((entry) => entry.event)).toEqual([
      "http.request.failed",
      "http.request.completed",
    ]);
    for (const entry of logger.entries) {
      expect(entry.fields.requestId).toBe(id);
    }
  });

  it("keeps the entries of concurrent requests apart", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger });

    const [first, second] = await Promise.all([
      request(app).get("/no-such-route"),
      request(app).get("/other-missing-route"),
    ]);

    const firstId = requestIdOf(first);
    const secondId = requestIdOf(second);
    expect(firstId).not.toBe(secondId);
    for (const [id, path] of [
      [firstId, "/no-such-route"],
      [secondId, "/other-missing-route"],
    ] as const) {
      const own = logger.entries.filter((entry) => entry.fields.requestId === id);
      expect(own).toHaveLength(2);
      const completed = own.find((entry) => entry.event === "http.request.completed");
      expect(completed?.fields.path).toBe(path);
    }
  });

  it("logs a request under the threshold at info", async () => {
    const logger = capturingLogger();
    const app = createApp({ logger, slowRequestThresholdMs: 60_000 });

    await request(app).get("/");

    const completed = logger.entries.filter((entry) => entry.event === "http.request.completed");
    expect(completed).toHaveLength(1);
    expect(completed[0]?.level).toBe("info");
  });

  it("logs a request over the threshold at warn", async () => {
    const logger = capturingLogger();
    // A negative threshold is exceeded by any duration, so no request has to sleep.
    const app = createApp({ logger, slowRequestThresholdMs: -1 });

    await request(app).get("/");

    const completed = logger.entries.filter((entry) => entry.event === "http.request.completed");
    expect(completed).toHaveLength(1);
    expect(completed[0]?.level).toBe("warn");
  });
});
