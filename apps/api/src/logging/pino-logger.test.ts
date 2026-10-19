import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createPinoLogger, REDACTED_VALUE, type PinoLoggerOptions } from "./pino-logger.js";

function build(level: PinoLoggerOptions["level"] = "debug") {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const logger = createPinoLogger({
    level,
    service: "trading-api",
    environment: "test",
    destination,
  });
  const entries = (): Record<string, unknown>[] =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, lines, entries };
}

describe("createPinoLogger", () => {
  it("writes one JSON line with the base fields of ADR-009 point 3", () => {
    const { logger, entries } = build();
    logger.info("http.request.completed", { requestId: "req-1", durationMs: 12 });

    const [entry] = entries();
    expect(entries()).toHaveLength(1);
    expect(entry).toMatchObject({
      level: "info",
      service: "trading-api",
      environment: "test",
      event: "http.request.completed",
      message: "http.request.completed",
      requestId: "req-1",
      durationMs: 12,
    });
    expect(typeof entry?.timestamp).toBe("string");
    expect(new Date(entry?.timestamp as string).toISOString()).toBe(entry?.timestamp);
  });

  it("uses the message the caller passes instead of the event name", () => {
    const { logger, entries } = build();
    logger.error("http.request.failed", { message: "Can't reach database server" });

    expect(entries()[0]).toMatchObject({
      event: "http.request.failed",
      message: "Can't reach database server",
    });
  });

  it("writes the level name, not pino's numeric level", () => {
    const { logger, entries } = build();
    logger.debug("a.b");
    logger.info("a.b");
    logger.warn("a.b");
    logger.error("a.b");

    expect(entries().map((entry) => entry.level)).toEqual(["debug", "info", "warn", "error"]);
  });

  it("drops entries below the configured level", () => {
    const { logger, entries } = build("warn");
    logger.debug("a.b");
    logger.info("a.b");
    logger.warn("a.b");

    expect(entries().map((entry) => entry.level)).toEqual(["warn"]);
  });

  it("writes nothing at the silent level", () => {
    const { logger, lines } = build("silent");
    logger.error("a.b");

    expect(lines).toEqual([]);
  });

  it("keeps the event name the caller passes when the fields carry an event key", () => {
    const { logger, entries } = build();
    logger.info("a.b", { event: "x.y" });

    expect(entries()[0]?.event).toBe("a.b");
  });
});

describe("createPinoLogger redaction", () => {
  const SECRET = "s3cr3t-value";

  it.each([
    ["a password", { password: SECRET }],
    ["a nested password", { body: { password: SECRET } }],
    ["an access token", { accessToken: SECRET }],
    ["a refresh token", { refreshToken: SECRET }],
    ["a nested refresh token", { session: { refreshToken: SECRET } }],
    ["the WebSocket authentication token", { auth: { token: SECRET } }],
    ["the stored CSV input of a job", { job: { input: SECRET } }],
    ["the Authorization header", { req: { headers: { authorization: SECRET } } }],
    ["the Cookie header", { req: { headers: { cookie: SECRET } } }],
    ["the response Set-Cookie header", { res: { headers: { "set-cookie": [SECRET] } } }],
  ])("never logs %s", (_name, fields) => {
    const { logger, lines, entries } = build();
    logger.info("a.b", fields);

    expect(lines.join("")).not.toContain(SECRET);
    expect(JSON.stringify(entries()[0])).toContain(REDACTED_VALUE);
  });

  it("leaves unrelated fields untouched", () => {
    const { logger, entries } = build();
    logger.info("a.b", { userId: "user-1", req: { headers: { "x-request-id": "req-1" } } });

    expect(entries()[0]).toMatchObject({
      userId: "user-1",
      req: { headers: { "x-request-id": "req-1" } },
    });
  });
});
