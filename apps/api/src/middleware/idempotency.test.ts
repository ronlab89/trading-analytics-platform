import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Express, RequestHandler } from "express";
import request from "supertest";
import { ConflictError } from "@trading/application";
import type { IdempotencyDecision, IdempotencyService } from "@trading/application";
import { errorHandler } from "./error-handler.js";
import { idempotency, idempotencyOf } from "./idempotency.js";
interface ErrorEnvelope {
  error: { code: string; details?: { field: string }[] };
}

function errorOf(response: { body: unknown }): ErrorEnvelope["error"] {
  return (response.body as ErrorEnvelope).error;
}

type Service = Pick<IdempotencyService, "begin" | "complete" | "release">;

function build(options: { decision?: IdempotencyDecision | Error; handler?: RequestHandler } = {}) {
  const begin = vi.fn((_request: Parameters<Service["begin"]>[0]) =>
    options.decision instanceof Error
      ? Promise.reject(options.decision)
      : Promise.resolve(options.decision ?? ({ kind: "proceed" } as const)),
  );
  const complete = vi.fn((_input: Parameters<Service["complete"]>[0]) => Promise.resolve(true));
  const release = vi.fn((_userId: string, _key: string) => Promise.resolve());
  const handler = vi.fn(
    options.handler ??
      ((_req, res) => {
        res.status(201).json({ data: { id: "t1" } });
      }),
  );

  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.logger = { debug: noop, info: noop, warn: noop, error: noop };
    req.actor = { userId: "u1", role: "TRADER" };
    next();
  });
  app.post("/portfolios/:portfolioId/things", idempotency({ begin, complete, release }), handler);
  app.use(errorHandler);

  return { app, begin, complete, release, handler };
}

const KEY = "Idempotency-Key";
const noop = (): void => undefined;

describe("idempotency middleware", () => {
  it("leaves a request without the header untouched", async () => {
    const { app, begin, complete, handler } = build();

    const response = await request(app).post("/portfolios/p1/things").send({ a: 1 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { id: "t1" } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(begin).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("reserves the key for the user before the handler runs", async () => {
    const { app, begin, handler } = build();

    await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({ a: 1 });

    expect(begin).toHaveBeenCalledWith({
      userId: "u1",
      key: "key-1",
      requestHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("answers a repeat with the stored response and does not run the handler", async () => {
    const { app, handler, complete } = build({
      decision: { kind: "replay", status: 201, body: { data: { id: "stored" } } },
    });

    const response = await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { id: "stored" } });
    expect(response.headers["idempotency-replayed"]).toBe("true");
    expect(handler).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("answers 409 CONFLICT for the same key with a different request or while one is in flight", async () => {
    const { app, handler } = build({ decision: new ConflictError("Used for another request.") });

    const response = await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(response.status).toBe(409);
    expect(errorOf(response).code).toBe("CONFLICT");
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(["", "has space", "x".repeat(256), "ñandú"])(
    "answers 400 for the invalid key %j before reserving anything",
    async (key) => {
      const { app, begin } = build();

      const response = await request(app).post("/portfolios/p1/things").set(KEY, key).send({});

      expect(response.status).toBe(400);
      expect(errorOf(response).code).toBe("VALIDATION_ERROR");
      expect(errorOf(response).details?.[0]?.field).toBe("Idempotency-Key");
      expect(begin).not.toHaveBeenCalled();
    },
  );

  it("exposes the key to the handler so it can store its response in its own unit of work", async () => {
    let seen: unknown;
    const { app } = build({
      handler: (_req, res) => {
        seen = idempotencyOf(res);
        res.status(201).json({ data: 1 });
      },
    });

    await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(seen).toEqual({ userId: "u1", key: "key-1" });
  });

  it("settles a success after the handler with a store that is a no-op when the unit already stored it", async () => {
    const { app, complete, release } = build();

    await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(complete).toHaveBeenCalledWith({
      userId: "u1",
      key: "key-1",
      responseStatus: 201,
      responseBody: { data: { id: "t1" } },
    });
    expect(release).not.toHaveBeenCalled();
  });

  it("stores a 4xx so the same request keeps getting the same answer", async () => {
    const { app, complete } = build({
      handler: (_req, res) => {
        res.status(409).json({ error: { code: "CONFLICT" } });
      },
    });

    await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        responseStatus: 409,
        responseBody: { error: { code: "CONFLICT" } },
      }),
    );
  });

  it("releases the key and stores nothing for a 5xx", async () => {
    const { app, complete, release } = build({
      handler: (_req, _res, next) => {
        next(new Error("db down"));
      },
    });

    const response = await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(response.status).toBe(500);
    expect(release).toHaveBeenCalledWith("u1", "key-1");
    expect(complete).not.toHaveBeenCalled();
  });

  it("still sends the response when settling the key fails", async () => {
    const { app, complete } = build();
    complete.mockRejectedValueOnce(new Error("db down"));

    const response = await request(app).post("/portfolios/p1/things").set(KEY, "key-1").send({});

    expect(response.status).toBe(201);
  });

  describe("request hash", () => {
    async function hashOf(path: string, payload: object, order = false) {
      const { app, begin } = build();
      const sent = order ? Object.fromEntries(Object.entries(payload).reverse()) : payload;
      await request(app).post(path).set(KEY, "key-1").send(sent);
      return begin.mock.calls[0]?.[0].requestHash;
    }

    it("is the same for the same route, parameters and body, whatever the key order of the body", async () => {
      const first = await hashOf("/portfolios/p1/things", { a: 1, b: { c: 2, d: 3 } });
      const second = await hashOf("/portfolios/p1/things", { b: { d: 3, c: 2 }, a: 1 }, true);

      expect(first).toBe(second);
    });

    it("differs when the body differs", async () => {
      expect(await hashOf("/portfolios/p1/things", { a: 1 })).not.toBe(
        await hashOf("/portfolios/p1/things", { a: 2 }),
      );
    });

    it("differs when the path parameters differ, so the same body against another portfolio is another request", async () => {
      expect(await hashOf("/portfolios/p1/things", { a: 1 })).not.toBe(
        await hashOf("/portfolios/p2/things", { a: 1 }),
      );
    });
  });
});
