import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { createApp } from "../app.js";
import { composition } from "../composition.js";
import { body } from "../test-utils/api-client.js";
import type { DataEnvelope, ErrorEnvelope } from "../test-utils/api-client.js";
import { tokenFor } from "../test-utils/auth.js";

interface StatusDto {
  state: string;
  mode: string;
}

/**
 * Integration tests for the simulation controls.
 * Source: ADR-007 points 10, 15 and 16, 07-api-spec.md §54, 08-realtime-spec.md §41.
 *
 * The simulator is the one of the composition, not booted: it keeps its state
 * and never ticks or touches the database. The token's role claim builds the
 * `Actor`, so a token per role is enough.
 */
describe("simulation control endpoints", () => {
  const app = createApp();
  const admin = `Bearer ${tokenFor("u-admin", "ADMIN")}`;
  const trader = `Bearer ${tokenFor("u-trader", "TRADER")}`;
  const viewer = `Bearer ${tokenFor("u-viewer", "VIEWER")}`;

  const control = [
    { method: "post", path: "/api/v1/simulation/start", send: undefined },
    { method: "post", path: "/api/v1/simulation/pause", send: undefined },
    { method: "put", path: "/api/v1/simulation/mode", send: { mode: "VOLATILE" } },
  ] as const;

  beforeEach(() => {
    composition.marketSimulator.start();
    composition.marketSimulator.setMode("NORMAL");
  });

  describe("as an ADMIN", () => {
    it("pauses and starts the simulation, answering the status each time", async () => {
      const paused = await request(app)
        .post("/api/v1/simulation/pause")
        .set("Authorization", admin);
      expect(paused.status).toBe(200);
      expect(body<DataEnvelope<StatusDto>>(paused).data).toEqual({
        state: "HALTED",
        mode: "NORMAL",
      });
      expect(composition.marketSimulator.status().state).toBe("HALTED");

      const started = await request(app)
        .post("/api/v1/simulation/start")
        .set("Authorization", admin);
      expect(started.status).toBe(200);
      expect(body<DataEnvelope<StatusDto>>(started).data).toEqual({
        state: "RUNNING",
        mode: "NORMAL",
      });
      expect(composition.marketSimulator.status().state).toBe("RUNNING");
    });

    it("answers 200 with the unchanged status when start or pause find nothing to change", async () => {
      const again = await request(app).post("/api/v1/simulation/start").set("Authorization", admin);
      expect(again.status).toBe(200);
      expect(body<DataEnvelope<StatusDto>>(again).data.state).toBe("RUNNING");

      await request(app).post("/api/v1/simulation/pause").set("Authorization", admin);
      const twice = await request(app).post("/api/v1/simulation/pause").set("Authorization", admin);
      expect(twice.status).toBe(200);
      expect(body<DataEnvelope<StatusDto>>(twice).data.state).toBe("HALTED");
    });

    it.each(["PAUSED", "NORMAL", "VOLATILE", "BULLISH", "BEARISH"])(
      "changes the mode to %s and answers it",
      async (mode) => {
        const response = await request(app)
          .put("/api/v1/simulation/mode")
          .set("Authorization", admin)
          .send({ mode });

        expect(response.status).toBe(200);
        expect(body<DataEnvelope<StatusDto>>(response).data).toEqual({ state: "RUNNING", mode });
        expect(composition.marketSimulator.status().mode).toBe(mode);
      },
    );

    it("changes the mode while the simulation is halted and keeps it halted", async () => {
      await request(app).post("/api/v1/simulation/pause").set("Authorization", admin);

      const response = await request(app)
        .put("/api/v1/simulation/mode")
        .set("Authorization", admin)
        .send({ mode: "BEARISH" });

      expect(body<DataEnvelope<StatusDto>>(response).data).toEqual({
        state: "HALTED",
        mode: "BEARISH",
      });
    });

    it.each([
      ["an unknown mode", { mode: "SIDEWAYS" }],
      ["a lifecycle state", { mode: "HALTED" }],
      ["a mode in lowercase", { mode: "normal" }],
      ["no mode", {}],
      ["a mode that is not text", { mode: 1 }],
    ])("rejects %s with 400 VALIDATION_ERROR and leaves the mode alone", async (_, payload) => {
      const response = await request(app)
        .put("/api/v1/simulation/mode")
        .set("Authorization", admin)
        .send(payload);

      expect(response.status).toBe(400);
      const error = body<ErrorEnvelope>(response).error;
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.map((detail) => detail.field)).toEqual(["mode"]);
      expect(composition.marketSimulator.status().mode).toBe("NORMAL");
    });
  });

  describe.each([
    ["a TRADER", trader],
    ["a VIEWER", viewer],
  ])("as %s", (_, token) => {
    it.each(control)(
      "is refused $method $path with 403 FORBIDDEN and the simulator is left alone",
      async ({ method, path, send }) => {
        const before = composition.marketSimulator.status();

        const response = await request(app)[method](path).set("Authorization", token).send(send);

        expect(response.status).toBe(403);
        expect(body<ErrorEnvelope>(response).error.code).toBe("FORBIDDEN");
        expect(composition.marketSimulator.status()).toEqual(before);
      },
    );
  });

  it.each(control)(
    "answers 401 UNAUTHORIZED to $method $path without a token",
    async ({ method, path, send }) => {
      const response = await request(app)[method](path).send(send);

      expect(response.status).toBe(401);
      expect(body<ErrorEnvelope>(response).error.code).toBe("UNAUTHORIZED");
    },
  );

  it("logs authz.denied with the missing permission when a TRADER is refused", async () => {
    const logger = capturingLogger();
    const loggedApp = createApp({ logger });

    await request(loggedApp).post("/api/v1/simulation/pause").set("Authorization", trader);

    const denied = logger.entries.filter((entry) => entry.event === "authz.denied");
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({
      level: "warn",
      fields: { userId: "u-trader", role: "TRADER", permission: "simulation:control" },
    });
  });
});
