import { describe, expect, it, vi } from "vitest";
import { createRealtimeShutdownStep } from "./realtime-step.js";

describe("realtime shutdown step", () => {
  it("is named realtime and stops the gateway", async () => {
    const stop = vi.fn(() => Promise.resolve());
    const step = createRealtimeShutdownStep({ stop });

    await step.run();

    expect(step.name).toBe("realtime");
    expect(stop).toHaveBeenCalledOnce();
  });

  it("fails when the gateway fails to stop", async () => {
    const step = createRealtimeShutdownStep({ stop: () => Promise.reject(new Error("boom")) });

    await expect(step.run()).rejects.toThrow("boom");
  });
});
