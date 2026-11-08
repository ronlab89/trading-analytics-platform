import { describe, expect, it } from "vitest";
import express from "express";
import request, { type Response } from "supertest";
import { capturingLogger } from "@trading/application";
import { attachLogger } from "./attach-logger.js";
import { requestId } from "./request-id.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requestIdOf(response: Response): string {
  const id: unknown = response.headers["x-request-id"];
  if (typeof id !== "string") throw new Error("The response has no X-Request-ID header.");
  return id;
}

function build() {
  const capture = capturingLogger();
  const app = express();
  app.use(requestId);
  app.use(attachLogger(capture));
  app.use(express.json());
  app.get("/ping", (req, res) => {
    req.logger.info("test.ping");
    res.json({ ok: true });
  });
  app.post("/echo", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    req.logger.info("test.echo", { size: JSON.stringify(req.body).length });
    res.json({ ok: true });
  });
  return { app, capture };
}

describe("requestId middleware", () => {
  it("generates an id, returns it in X-Request-ID and logs under it", async () => {
    const { app, capture } = build();

    const response = await request(app).get("/ping");

    const id = requestIdOf(response);
    expect(id).toMatch(UUID);
    expect(capture.entries).toEqual([
      { level: "info", event: "test.ping", fields: { requestId: id } },
    ]);
  });

  it("reuses a client id that matches the allowlist", async () => {
    const { app, capture } = build();

    const response = await request(app).get("/ping").set("X-Request-ID", "client-id-42");

    expect(response.headers["x-request-id"]).toBe("client-id-42");
    expect(capture.entries[0]?.fields).toEqual({ requestId: "client-id-42" });
  });

  it("replaces a client id that does not match the allowlist", async () => {
    const { app, capture } = build();

    const response = await request(app).get("/ping").set("X-Request-ID", "req_123");

    const id = requestIdOf(response);
    expect(id).toMatch(UUID);
    expect(capture.entries[0]?.fields).toEqual({ requestId: id });
  });

  it("keeps the id after the body parser and an await", async () => {
    const { app, capture } = build();

    const response = await request(app).post("/echo").send({ symbol: "AAPL" });

    expect(capture.entries[0]).toMatchObject({
      event: "test.echo",
      fields: { requestId: requestIdOf(response) },
    });
  });

  it("keeps two simultaneous requests apart", async () => {
    const { app, capture } = build();

    const [first, second] = await Promise.all([
      request(app).post("/echo").set("X-Request-ID", "first").send({ n: 1 }),
      request(app).post("/echo").set("X-Request-ID", "second").send({ n: 2 }),
    ]);

    expect(first.headers["x-request-id"]).toBe("first");
    expect(second.headers["x-request-id"]).toBe("second");
    expect(capture.entries.map((entry) => entry.fields.requestId).sort()).toEqual([
      "first",
      "second",
    ]);
  });
});
