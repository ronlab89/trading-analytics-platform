import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { attachLogger } from "./attach-logger.js";
import { requestId } from "./request-id.js";
import { requestLogger } from "./request-logger.js";

const SLOW_MS = 500;

/** An app whose handlers advance a fake clock, so durations are exact. */
function build(slowThresholdMs = SLOW_MS) {
  const capture = capturingLogger();
  let clock = 0;
  const app = express();
  app.use(requestId);
  app.use(attachLogger(capture));
  app.use(requestLogger({ slowThresholdMs, now: () => clock }));
  app.get("/work/:ms", (req, res) => {
    clock += Number(req.params.ms);
    res.json({ ok: true });
  });
  app.get("/signed-in", (req, res) => {
    req.auth = { userId: "user-1", role: "TRADER" };
    res.json({ ok: true });
  });
  app.get("/boom", (_req, res) => {
    res.status(500).json({ error: "boom" });
  });
  return { app, capture };
}

describe("requestLogger", () => {
  it("writes one http.request.completed entry with method, path, status and duration", async () => {
    const { app, capture } = build();

    await request(app).get("/work/120");

    expect(capture.entries).toHaveLength(1);
    expect(capture.entries[0]).toMatchObject({
      level: "info",
      event: "http.request.completed",
      fields: { method: "GET", path: "/work/120", status: 200, durationMs: 120 },
    });
  });

  it("logs under the requestId of the response", async () => {
    const { app, capture } = build();

    const response = await request(app).get("/work/1");

    expect(capture.entries[0]?.fields.requestId).toBe(response.headers["x-request-id"]);
  });

  it("drops the query string, so tokens in it never reach the log", async () => {
    const { app, capture } = build();

    await request(app).get("/work/1?token=s3cret&page=2");

    expect(capture.entries[0]?.fields.path).toBe("/work/1");
    expect(JSON.stringify(capture.entries)).not.toContain("s3cret");
  });

  it("stays at info when the duration equals the threshold", async () => {
    const { app, capture } = build();

    await request(app).get(`/work/${SLOW_MS.toString()}`);

    expect(capture.entries[0]).toMatchObject({ level: "info", fields: { durationMs: SLOW_MS } });
  });

  it("raises the same entry to warn above the threshold", async () => {
    const { app, capture } = build();

    await request(app).get(`/work/${(SLOW_MS + 1).toString()}`);

    expect(capture.entries).toHaveLength(1);
    expect(capture.entries[0]).toMatchObject({
      level: "warn",
      event: "http.request.completed",
      fields: { durationMs: SLOW_MS + 1 },
    });
  });

  it("uses the configured threshold", async () => {
    const { app, capture } = build(50);

    await request(app).get("/work/51");

    expect(capture.entries[0]?.level).toBe("warn");
  });

  it("records the status of a failed response without changing the level", async () => {
    const { app, capture } = build();

    await request(app).get("/boom");

    expect(capture.entries[0]).toMatchObject({ level: "info", fields: { status: 500 } });
  });

  it("includes the userId only once the request is authenticated", async () => {
    const { app, capture } = build();

    await request(app).get("/work/1");
    await request(app).get("/signed-in");

    expect(capture.entries[0]?.fields).not.toHaveProperty("userId");
    expect(capture.entries[1]?.fields).toMatchObject({ userId: "user-1" });
  });
});
