import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { fixedClock } from "@trading/application";
import type { AppError } from "../errors/app-error.js";
import { createTokenService } from "./token.service.js";

const SECRET = "s".repeat(40);
const TTL = 900;
const NOW = new Date("2026-10-18T12:00:00.000Z");

function serviceAt(instant: Date, secret = SECRET) {
  return createTokenService({ secret, ttlSeconds: TTL, clock: fixedClock(instant) });
}

function afterSeconds(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

function expectUnauthorized(action: () => unknown): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  const error = caught as AppError;
  expect(error.statusCode).toBe(401);
  expect(error.code).toBe("UNAUTHORIZED");
  expect(error.message).toBe("Authentication required.");
}

describe("token service", () => {
  const claims = { userId: "u1", role: "TRADER" } as const;

  it("issues a 15-minute token whose expiry comes from the injected clock", () => {
    const { accessToken, expiresAt } = serviceAt(NOW).issue(claims);

    expect(expiresAt).toEqual(afterSeconds(TTL));
    const payload = jwt.decode(accessToken) as Record<string, unknown>;
    expect(payload).toMatchObject({ sub: "u1", role: "TRADER", exp: expiresAt.getTime() / 1000 });
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "role", "sub"]);
  });

  it.each(["VIEWER", "TRADER", "ADMIN"] as const)("round-trips a %s token", (role) => {
    const { accessToken } = serviceAt(NOW).issue({ userId: "u1", role });

    expect(serviceAt(NOW).verify(accessToken)).toEqual({ userId: "u1", role });
  });

  it("accepts the token until the last second before expiry", () => {
    const { accessToken } = serviceAt(NOW).issue(claims);

    expect(serviceAt(afterSeconds(TTL - 1)).verify(accessToken)).toEqual(claims);
  });

  it("rejects the token from the second it expires", () => {
    const { accessToken } = serviceAt(NOW).issue(claims);

    expectUnauthorized(() => serviceAt(afterSeconds(TTL)).verify(accessToken));
    expectUnauthorized(() => serviceAt(afterSeconds(TTL * 10)).verify(accessToken));
  });

  it("rejects a token signed with another secret", () => {
    const { accessToken } = serviceAt(NOW, "x".repeat(40)).issue(claims);

    expectUnauthorized(() => serviceAt(NOW).verify(accessToken));
  });

  it("rejects a token whose payload was tampered with", () => {
    const { accessToken } = serviceAt(NOW).issue({ userId: "u1", role: "VIEWER" });
    const [header = "", , signature = ""] = accessToken.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "u1", role: "ADMIN", iat: 1, exp: 9999999999 }),
    ).toString("base64url");

    expectUnauthorized(() => serviceAt(NOW).verify(`${header}.${forgedPayload}.${signature}`));
  });

  it.each(["USER", "SUPERUSER", ""])("rejects a token whose role is %j", (role) => {
    const token = jwt.sign({ sub: "u1", role }, SECRET, { expiresIn: TTL });

    expectUnauthorized(() => serviceAt(new Date()).verify(token));
  });

  it("rejects a token without a role or without a subject", () => {
    const noRole = jwt.sign({ sub: "u1" }, SECRET, { expiresIn: TTL });
    const noSubject = jwt.sign({ role: "TRADER" }, SECRET, { expiresIn: TTL });

    expectUnauthorized(() => serviceAt(new Date()).verify(noRole));
    expectUnauthorized(() => serviceAt(new Date()).verify(noSubject));
  });

  it("rejects a token signed with another algorithm than HS256", () => {
    const hs512 = jwt.sign({ sub: "u1", role: "TRADER" }, SECRET, {
      algorithm: "HS512",
      expiresIn: TTL,
    });

    expectUnauthorized(() => serviceAt(new Date()).verify(hs512));
  });

  it("rejects an unsigned token and garbage", () => {
    const unsigned = jwt.sign({ sub: "u1", role: "TRADER" }, "", { algorithm: "none" });

    expectUnauthorized(() => serviceAt(NOW).verify(unsigned));
    expectUnauthorized(() => serviceAt(NOW).verify("not-a-token"));
    expectUnauthorized(() => serviceAt(NOW).verify(""));
  });
});
