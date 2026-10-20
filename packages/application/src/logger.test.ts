import { describe, expect, it } from "vitest";
import { capturingLogger, silentLogger } from "./logger.js";

describe("capturingLogger", () => {
  it("records level, event and fields in call order", () => {
    const logger = capturingLogger();
    logger.info("http.request.completed", { requestId: "req-1", durationMs: 12 });
    logger.warn("authz.denied");
    expect(logger.entries).toEqual([
      {
        level: "info",
        event: "http.request.completed",
        fields: { requestId: "req-1", durationMs: 12 },
      },
      { level: "warn", event: "authz.denied", fields: {} },
    ]);
  });

  it("records every level under its own name", () => {
    const logger = capturingLogger();
    logger.debug("a.b");
    logger.info("a.b");
    logger.warn("a.b");
    logger.error("a.b");
    expect(logger.entries.map((entry) => entry.level)).toEqual(["debug", "info", "warn", "error"]);
  });
});

describe("silentLogger", () => {
  it("accepts every level without throwing", () => {
    expect(() => {
      silentLogger.debug("a.b");
      silentLogger.info("a.b", { x: 1 });
      silentLogger.warn("a.b");
      silentLogger.error("a.b");
    }).not.toThrow();
  });
});
