import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "@trading/persistence-memory";
import { UserRole, type User } from "@trading/domain";
import { createGraceTokenCipher } from "./grace-token-cipher.js";
import { createLogoutService, type LogoutService } from "./logout.service.js";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token.js";
import { createRefreshService, type RefreshService } from "./refresh.service.js";
import { createTokenService } from "./token.service.js";

const secret = "a-test-secret-with-at-least-32-characters";
const start = new Date("2026-10-18T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const user: User = {
  id: "user-1",
  email: "trader@example.com",
  displayName: "Trader",
  role: UserRole.TRADER,
  createdAt: start,
  updatedAt: start,
};

describe("logout service", () => {
  let current: Date;
  let sessions: InMemorySessionRepository;
  let logout: LogoutService;
  let refresh: RefreshService;

  const clock = { now: () => current };

  const startSession = async (familyId = "family-1") => {
    const token = generateRefreshToken();
    await sessions.create({
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(start.getTime() + 30 * DAY),
    });
    return token;
  };

  beforeEach(() => {
    current = start;
    sessions = new InMemorySessionRepository({ now: () => current });
    logout = createLogoutService({ sessions, clock });
    refresh = createRefreshService({
      sessions,
      users: { getById: () => Promise.resolve(user) },
      accessTokens: createTokenService({ secret, ttlSeconds: 900, clock }),
      graceCipher: createGraceTokenCipher(secret),
      clock,
      idleSeconds: (7 * DAY) / 1000,
    });
  });

  it("revokes the session so its refresh token stops working", async () => {
    const token = await startSession();

    await logout.logout(token);

    expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).toEqual(start);
    await expect(refresh.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("revokes the successors too, so a token already rotated cannot be used", async () => {
    const first = await startSession();
    const rotated = await refresh.refresh(first);

    await logout.logout(first);

    await expect(refresh.refresh(rotated.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("leaves the sessions of other families untouched", async () => {
    const token = await startSession("family-1");
    const other = await startSession("family-2");

    await logout.logout(token);

    await expect(refresh.refresh(other)).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("drops the stored successor token of the family", async () => {
    const first = await startSession();
    await refresh.refresh(first);

    await logout.logout(first);

    expect(
      (await sessions.getByTokenHash(hashRefreshToken(first)))?.successorCiphertext,
    ).toBeNull();
  });

  it("returns the owner of the session it ended", async () => {
    const token = await startSession();

    await expect(logout.logout(token)).resolves.toBe(user.id);
  });

  it("can be repeated without error or a new revocation time, and ends nothing the second time", async () => {
    const token = await startSession();
    await logout.logout(token);
    current = new Date(start.getTime() + 60 * 1000);

    await expect(logout.logout(token)).resolves.toBeUndefined();

    expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).toEqual(start);
  });

  it("does nothing, without error, for a missing, empty or unknown token", async () => {
    const token = await startSession();

    await expect(logout.logout(undefined)).resolves.toBeUndefined();
    await expect(logout.logout("")).resolves.toBeUndefined();
    await expect(logout.logout("unknown")).resolves.toBeUndefined();
    expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).toBeNull();
  });
});
