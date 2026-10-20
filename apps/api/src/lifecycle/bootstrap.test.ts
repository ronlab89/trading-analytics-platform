import { EventEmitter, once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import { startServer } from "./bootstrap.js";
import { createShutdown } from "./shutdown.js";

/** Records the exit code and lets a test wait for the process "to end". */
function fakeExit() {
  let resolve!: (code: number) => void;
  const exited = new Promise<number>((done) => {
    resolve = done;
  });
  return {
    exit: vi.fn((code: number) => {
      resolve(code);
    }),
    exited,
  };
}

/** An app with one route that answers after `delayMs` and says when a request reached it. */
function slowApp(delayMs: number) {
  const app = express();
  let reached!: () => void;
  const requestInFlight = new Promise<void>((done) => {
    reached = done;
  });
  app.get("/slow", (_req, res) => {
    reached();
    setTimeout(() => res.send("finished"), delayMs);
  });
  return { app, requestInFlight };
}

describe("startServer", () => {
  const servers: { close(): void }[] = [];

  afterEach(() => {
    for (const server of servers.splice(0)) {
      try {
        server.close();
      } catch {
        // already closed by the shutdown under test
      }
    }
  });

  function setup(
    app: express.Express,
    options: { drainTimeoutMs?: number; disconnect?: () => Promise<void> } = {},
  ) {
    const logger = capturingLogger();
    const { exit, exited } = fakeExit();
    const signals = new EventEmitter();
    const shutdown = createShutdown({ logger, exit });
    const disconnect = vi.fn(options.disconnect ?? (() => Promise.resolve()));
    const server = startServer({
      app,
      port: 0,
      logger,
      shutdown,
      disconnect,
      signals,
      drainTimeoutMs: options.drainTimeoutMs ?? 2000,
    });
    servers.push(server);
    // Registered right after `startServer`, so it resolves after the startup entry is logged.
    const listening = once(server, "listening");
    const url = async () => {
      await listening;
      return `http://127.0.0.1:${(server.address() as AddressInfo).port.toString()}`;
    };
    return { logger, exit, exited, signals, disconnect, server, url };
  }

  it("logs app.startup.started before listening and app.startup.completed once it listens", async () => {
    const { logger, server, url } = setup(express());
    expect(logger.entries.map((entry) => entry.event)).toEqual(["app.startup.started"]);

    await url();

    const port = (server.address() as AddressInfo).port;
    expect(logger.entries).toEqual([
      { level: "info", event: "app.startup.started", fields: { port: 0 } },
      { level: "info", event: "app.startup.completed", fields: { port } },
    ]);
  });

  it("drains an in-flight request on SIGTERM, closes the database after it, and exits 0", async () => {
    const { app, requestInFlight } = slowApp(150);
    const { logger, signals, exited, disconnect, url } = setup(app);
    const base = await url();

    const inFlight = fetch(`${base}/slow`);
    await requestInFlight;
    signals.emit("SIGTERM");

    const response = await inFlight;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("finished");
    expect(await exited).toBe(0);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.entries.slice(-2)).toEqual([
      { level: "info", event: "app.shutdown.started", fields: { signal: "SIGTERM" } },
      { level: "info", event: "app.shutdown.completed", fields: { exitCode: 0 } },
    ]);
  });

  it("stops accepting new connections once the signal arrives", async () => {
    const { app, requestInFlight } = slowApp(150);
    const { signals, exited, url } = setup(app);
    const base = await url();
    const inFlight = fetch(`${base}/slow`);
    await requestInFlight;

    signals.emit("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(fetch(`${base}/slow`)).rejects.toThrow();
    await inFlight;
    await exited;
  });

  it("reacts to SIGINT the same way", async () => {
    const { logger, signals, exited } = setup(express());

    signals.emit("SIGINT");

    expect(await exited).toBe(0);
    expect(logger.entries).toContainEqual({
      level: "info",
      event: "app.shutdown.started",
      fields: { signal: "SIGINT" },
    });
  });

  it("closes the remaining connections and exits 1 when the drain expires", async () => {
    const { app, requestInFlight } = slowApp(5000);
    const { logger, signals, exited, disconnect, url } = setup(app, { drainTimeoutMs: 80 });
    const base = await url();

    const inFlight = fetch(`${base}/slow`);
    const abandoned = expect(inFlight).rejects.toThrow();
    await requestInFlight;
    signals.emit("SIGTERM");

    expect(await exited).toBe(1);
    await abandoned;
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.entries).toContainEqual({
      level: "error",
      event: "app.shutdown.step_failed",
      fields: { step: "http", errorName: "DrainTimeoutError" },
    });
    expect(logger.entries.at(-1)).toEqual({
      level: "info",
      event: "app.shutdown.completed",
      fields: { exitCode: 1, failedSteps: ["http"] },
    });
  });

  it("exits 1 when the database does not close, after the server drained", async () => {
    const { logger, signals, exited } = setup(express(), {
      disconnect: () => Promise.reject(new Error("connection lost")),
    });

    signals.emit("SIGTERM");

    expect(await exited).toBe(1);
    expect(logger.entries.at(-1)).toEqual({
      level: "info",
      event: "app.shutdown.completed",
      fields: { exitCode: 1, failedSteps: ["database"] },
    });
  });

  it("shuts down once when both signals arrive", async () => {
    const { logger, signals, exited, disconnect } = setup(express());

    signals.emit("SIGTERM");
    signals.emit("SIGINT");

    await exited;
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.entries.filter((entry) => entry.event === "app.shutdown.started")).toHaveLength(
      1,
    );
  });
});
