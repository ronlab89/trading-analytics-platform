import { describe, expect, it, vi } from "vitest";
import { capturingLogger } from "./logger.js";
import { publishQuietly } from "./publish-quietly.js";

describe("publishQuietly", () => {
  it("runs the publish and writes nothing when it succeeds", async () => {
    const logger = capturingLogger();
    const publish = vi.fn(() => Promise.resolve());

    await publishQuietly(logger, "JOB_COMPLETED", { jobId: "j1" }, publish);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(logger.entries).toEqual([]);
  });

  it("logs a warning with the event and fields when the publish rejects", async () => {
    const logger = capturingLogger();

    await publishQuietly(logger, "JOB_COMPLETED", { jobId: "j1" }, () =>
      Promise.reject(new Error("socket gone")),
    );

    expect(logger.entries).toEqual([
      {
        level: "warn",
        event: "realtime.publish_failed",
        fields: { event: "JOB_COMPLETED", jobId: "j1", error: "socket gone" },
      },
    ]);
  });

  it("logs a warning when the publish throws before returning a promise", async () => {
    const logger = capturingLogger();

    await expect(
      publishQuietly(logger, "PORTFOLIO_UPDATED", { portfolioId: "p1" }, (): Promise<void> => {
        throw new Error("hub gone");
      }),
    ).resolves.toBeUndefined();

    expect(logger.entries).toMatchObject([{ level: "warn", fields: { error: "hub gone" } }]);
  });

  it("logs the text of a rejection that is not an Error", async () => {
    const logger = capturingLogger();

    await publishQuietly(logger, "JOB_FAILED", {}, (): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- a non-Error rejection is the case under test
      throw "boom";
    });

    expect(logger.entries).toMatchObject([{ fields: { error: "boom" } }]);
  });
});
