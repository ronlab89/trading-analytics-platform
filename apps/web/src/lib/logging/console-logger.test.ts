import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleLogger, REDACTED_VALUE } from "@/lib/logging/console-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

function spyOnConsole() {
  return {
    debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
    info: vi.spyOn(console, "info").mockImplementation(() => undefined),
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
    error: vi.spyOn(console, "error").mockImplementation(() => undefined),
  };
}

describe("createConsoleLogger", () => {
  it("writes each level to the matching console method with the event and the fields", () => {
    const spies = spyOnConsole();
    const logger = createConsoleLogger({ level: "debug" });

    logger.debug("a.debug", { id: 1 });
    logger.info("a.info", { id: 2 });
    logger.warn("a.warn", { id: 3 });
    logger.error("a.error", { id: 4 });

    expect(spies.debug).toHaveBeenCalledWith("a.debug", { event: "a.debug", id: 1 });
    expect(spies.info).toHaveBeenCalledWith("a.info", { event: "a.info", id: 2 });
    expect(spies.warn).toHaveBeenCalledWith("a.warn", { event: "a.warn", id: 3 });
    expect(spies.error).toHaveBeenCalledWith("a.error", { event: "a.error", id: 4 });
  });

  it("uses the message of the caller instead of the event name and keeps it out of the fields", () => {
    const spies = spyOnConsole();
    const logger = createConsoleLogger({ level: "info" });

    logger.info("auth.login.succeeded", { message: "Signed in", userId: "u1" });

    expect(spies.info).toHaveBeenCalledWith("Signed in", {
      event: "auth.login.succeeded",
      userId: "u1",
    });
  });

  it("drops the entries below the configured level", () => {
    const spies = spyOnConsole();
    const logger = createConsoleLogger({ level: "warn" });

    logger.debug("a.debug");
    logger.info("a.info");
    logger.warn("a.warn");
    logger.error("a.error");

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(spies.error).toHaveBeenCalledTimes(1);
  });

  it("writes nothing at the silent level", () => {
    const spies = spyOnConsole();
    const logger = createConsoleLogger({ level: "silent" });

    logger.error("a.error");

    expect(spies.error).not.toHaveBeenCalled();
  });

  it("redacts the sensitive fields at any depth, whatever their case", () => {
    const spies = spyOnConsole();
    const logger = createConsoleLogger({ level: "info" });

    logger.info("a.event", {
      password: "p",
      accessToken: "a",
      refreshToken: "r",
      token: "t",
      input: "csv",
      req: { headers: { Authorization: "Bearer x", Cookie: "c=1", accept: "json" } },
      items: [{ token: "t2", name: "kept" }],
    });

    expect(spies.info).toHaveBeenCalledWith("a.event", {
      event: "a.event",
      password: REDACTED_VALUE,
      accessToken: REDACTED_VALUE,
      refreshToken: REDACTED_VALUE,
      token: REDACTED_VALUE,
      input: REDACTED_VALUE,
      req: { headers: { Authorization: REDACTED_VALUE, Cookie: REDACTED_VALUE, accept: "json" } },
      items: [{ token: REDACTED_VALUE, name: "kept" }],
    });
  });

  it("does not modify the fields the caller passed", () => {
    spyOnConsole();
    const logger = createConsoleLogger({ level: "info" });
    const fields = { password: "p" };

    logger.info("a.event", fields);

    expect(fields).toEqual({ password: "p" });
  });
});
