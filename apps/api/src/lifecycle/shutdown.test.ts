import { describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import { createShutdown, type ShutdownStep } from "./shutdown.js";

function setup() {
  const logger = capturingLogger();
  const exit = vi.fn<(code: number) => void>();
  const shutdown = createShutdown({ logger, exit });
  return { logger, exit, shutdown };
}

function step(name: string, calls: string[], run?: () => Promise<void>): ShutdownStep {
  return {
    name,
    run: async () => {
      calls.push(name);
      await run?.();
    },
  };
}

describe("createShutdown", () => {
  it("runs the registered steps one after another, in registration order", async () => {
    const { shutdown } = setup();
    const calls: string[] = [];
    shutdown.register(
      step("first", calls, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        calls.push("first-done");
      }),
    );
    shutdown.register(step("second", calls));

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["first", "first-done", "second"]);
  });

  it("is not shutting down until triggered, and is from the first instant after", async () => {
    const { shutdown } = setup();
    let seenByStep: boolean | undefined;
    shutdown.register({
      name: "probe",
      run: () => {
        seenByStep = shutdown.isShuttingDown();
        return Promise.resolve();
      },
    });
    expect(shutdown.isShuttingDown()).toBe(false);

    const done = shutdown.trigger("SIGINT");
    expect(shutdown.isShuttingDown()).toBe(true);
    await done;

    expect(seenByStep).toBe(true);
  });

  it("logs app.shutdown.started then app.shutdown.completed at info and exits 0", async () => {
    const { logger, exit, shutdown } = setup();
    shutdown.register(step("quiet", []));

    await shutdown.trigger("SIGTERM");

    expect(logger.entries).toEqual([
      { level: "info", event: "app.shutdown.started", fields: { signal: "SIGTERM" } },
      { level: "info", event: "app.shutdown.completed", fields: { exitCode: 0 } },
    ]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("exits only after the completed entry is logged", async () => {
    const logger = capturingLogger();
    const exitedAfter: string[] = [];
    const exit = vi.fn(() => {
      exitedAfter.push(...logger.entries.map((entry) => entry.event));
    });

    await createShutdown({ logger, exit }).trigger("SIGTERM");

    expect(exitedAfter).toEqual(["app.shutdown.started", "app.shutdown.completed"]);
  });

  it("keeps going after a failed step, logs it, and exits 1", async () => {
    const { logger, exit, shutdown } = setup();
    const calls: string[] = [];
    shutdown.register(
      step("http", calls, () => Promise.reject(new TypeError("postgres://user:s3cret@db/x"))),
    );
    shutdown.register(step("database", calls));

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["http", "database"]);
    expect(logger.entries).toContainEqual({
      level: "error",
      event: "app.shutdown.step_failed",
      fields: { step: "http", errorName: "TypeError" },
    });
    expect(logger.entries.at(-1)).toEqual({
      level: "info",
      event: "app.shutdown.completed",
      fields: { exitCode: 1, failedSteps: ["http"] },
    });
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(JSON.stringify(logger.entries)).not.toContain("s3cret");
  });

  it("runs once when signalled twice and returns the same promise", async () => {
    const { logger, exit, shutdown } = setup();
    const calls: string[] = [];
    shutdown.register(step("only", calls));

    const first = shutdown.trigger("SIGTERM");
    const second = shutdown.trigger("SIGINT");

    expect(second).toBe(first);
    await first;
    expect(calls).toEqual(["only"]);
    expect(logger.entries.filter((entry) => entry.event === "app.shutdown.started")).toHaveLength(
      1,
    );
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("completes with exit 0 when no step is registered", async () => {
    const { exit, shutdown } = setup();

    await shutdown.trigger("SIGTERM");

    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
