import { describe, expect, it } from "vitest";
import { capturingLogger } from "@trading/application";
import { runWithRequestContext, withRequestContext } from "./request-context.js";

function build() {
  const capture = capturingLogger();
  return { capture, logger: withRequestContext(capture) };
}

describe("withRequestContext", () => {
  it("adds the requestId of the running request to every level", () => {
    const { capture, logger } = build();

    runWithRequestContext({ requestId: "req-1" }, () => {
      logger.debug("a.b");
      logger.info("a.b");
      logger.warn("a.b");
      logger.error("a.b");
    });

    expect(capture.entries.map((entry) => entry.fields)).toEqual([
      { requestId: "req-1" },
      { requestId: "req-1" },
      { requestId: "req-1" },
      { requestId: "req-1" },
    ]);
  });

  it("keeps the fields the caller passes", () => {
    const { capture, logger } = build();

    runWithRequestContext({ requestId: "req-1" }, () => {
      logger.info("a.b", { userId: "user-1", durationMs: 12 });
    });

    expect(capture.entries[0]?.fields).toEqual({
      userId: "user-1",
      durationMs: 12,
      requestId: "req-1",
    });
  });

  it("passes the entry through untouched outside a request", () => {
    const { capture, logger } = build();

    logger.info("app.startup.started", { port: 7001 });
    logger.info("app.startup.completed");

    expect(capture.entries.map((entry) => entry.fields)).toEqual([{ port: 7001 }, {}]);
  });

  it("does not let the fields file an entry under another request", () => {
    const { capture, logger } = build();

    runWithRequestContext({ requestId: "req-1" }, () => {
      logger.info("a.b", { requestId: "req-2" });
    });

    expect(capture.entries[0]?.fields).toEqual({ requestId: "req-1" });
  });

  it("follows the request across awaits", async () => {
    const { capture, logger } = build();

    await runWithRequestContext({ requestId: "req-1" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      logger.info("a.b");
    });

    expect(capture.entries[0]?.fields).toEqual({ requestId: "req-1" });
  });

  it("keeps concurrent requests apart", async () => {
    const { capture, logger } = build();
    const request = (requestId: string, delayMs: number) =>
      runWithRequestContext({ requestId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        logger.info("a.b", { who: requestId });
      });

    await Promise.all([request("req-slow", 10), request("req-fast", 1)]);

    expect(capture.entries.map((entry) => entry.fields)).toEqual([
      { who: "req-fast", requestId: "req-fast" },
      { who: "req-slow", requestId: "req-slow" },
    ]);
  });
});
