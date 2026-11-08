import { describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import { createShutdown } from "./shutdown.js";
import { createSimulatorShutdownStep } from "./simulator-step.js";

describe("createSimulatorShutdownStep", () => {
  it("stops the simulator before the steps registered after it", async () => {
    const calls: string[] = [];
    const exit = vi.fn<(code: number) => void>();
    const shutdown = createShutdown({ logger: capturingLogger(), exit });

    shutdown.register(
      createSimulatorShutdownStep({
        stop: () => {
          calls.push("simulator");
          return Promise.resolve();
        },
      }),
    );
    shutdown.register({
      name: "database",
      run: () => {
        calls.push("database");
        return Promise.resolve();
      },
    });

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["simulator", "database"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("fails the sequence with exit code 1 when the simulator cannot stop, and still closes the rest", async () => {
    const calls: string[] = [];
    const exit = vi.fn<(code: number) => void>();
    const shutdown = createShutdown({ logger: capturingLogger(), exit });

    shutdown.register(
      createSimulatorShutdownStep({ stop: () => Promise.reject(new Error("tick stuck")) }),
    );
    shutdown.register({
      name: "database",
      run: () => {
        calls.push("database");
        return Promise.resolve();
      },
    });

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["database"]);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
