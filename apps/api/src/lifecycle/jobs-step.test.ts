import { describe, expect, it, vi } from "vitest";
import { capturingLogger } from "@trading/application";
import { createShutdown } from "./shutdown.js";
import type { ShutdownStep } from "./shutdown.js";
import { createJobsShutdownStep } from "./jobs-step.js";

describe("createJobsShutdownStep", () => {
  it("stops the runner before the steps registered after it", async () => {
    const calls: string[] = [];
    const exit = vi.fn<(code: number) => void>();
    const shutdown = createShutdown({ logger: capturingLogger(), exit });
    const http: ShutdownStep = {
      name: "http",
      run: () => {
        calls.push("http");
        return Promise.resolve();
      },
    };

    shutdown.register(
      createJobsShutdownStep({
        stop: () => {
          calls.push("jobs");
          return Promise.resolve();
        },
      }),
    );
    shutdown.register(http);

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["jobs", "http"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("fails the sequence with exit code 1 when the runner cannot stop, and still closes the rest", async () => {
    const calls: string[] = [];
    const exit = vi.fn<(code: number) => void>();
    const shutdown = createShutdown({ logger: capturingLogger(), exit });

    shutdown.register(createJobsShutdownStep({ stop: () => Promise.reject(new Error("db down")) }));
    shutdown.register({
      name: "http",
      run: () => {
        calls.push("http");
        return Promise.resolve();
      },
    });

    await shutdown.trigger("SIGTERM");

    expect(calls).toEqual(["http"]);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
