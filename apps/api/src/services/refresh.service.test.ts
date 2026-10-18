import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySessionRepository } from "@trading/persistence-memory";
import { UserRole, type User } from "@trading/domain";
import { createGraceTokenCipher } from "./grace-token-cipher.js";
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

describe("refresh service", () => {
  let current: Date;
  let sessions: InMemorySessionRepository;
  let service: RefreshService;
  let known: User | null;

  const clock = { now: () => current };
  const advance = (milliseconds: number) => {
    current = new Date(current.getTime() + milliseconds);
  };

  /** Starts a session the way login does and returns its refresh token. */
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
    known = user;
    sessions = new InMemorySessionRepository({ now: () => current });
    service = createRefreshService({
      sessions,
      users: { getById: () => Promise.resolve(known) },
      accessTokens: createTokenService({ secret, ttlSeconds: 900, clock }),
      graceCipher: createGraceTokenCipher(secret),
      clock,
      idleSeconds: (7 * DAY) / 1000,
    });
  });

  it("rotates a live token into a new access and refresh pair", async () => {
    const token = await startSession();

    const result = await service.refresh(token);

    expect(result.user).toEqual({
      id: "user-1",
      email: "trader@example.com",
      displayName: "Trader",
      role: "TRADER",
    });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.expiresAt).toEqual(new Date(start.getTime() + 900 * 1000));
    expect(result.refreshToken).not.toBe(token);
    expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.rotatedAt).toEqual(start);
  });

  it("keeps the family and its absolute expiry on the successor", async () => {
    const token = await startSession();
    const original = await sessions.getByTokenHash(hashRefreshToken(token));

    const result = await service.refresh(token);

    const successor = await sessions.getByTokenHash(hashRefreshToken(result.refreshToken));
    expect(successor).toMatchObject({
      familyId: original?.familyId,
      expiresAt: original?.expiresAt,
      lastUsedAt: start,
      rotatedAt: null,
      revokedAt: null,
    });
  });

  it("lets the successor be refreshed in turn", async () => {
    const first = await service.refresh(await startSession());
    advance(60 * 1000);

    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it("returns the same refresh token to a retry inside the grace window (lost first response)", async () => {
    const token = await startSession();
    const first = await service.refresh(token);
    advance(5 * 1000);

    const retry = await service.refresh(token);

    expect(retry.refreshToken).toBe(first.refreshToken);
    expect(retry.user).toEqual(first.user);
    expect((await sessions.getByTokenHash(hashRefreshToken(token)))?.revokedAt).toBeNull();
  });

  it("gives two parallel refreshes the same pair and rotates only once", async () => {
    const token = await startSession();

    const [a, b] = await Promise.all([service.refresh(token), service.refresh(token)]);

    expect(a.refreshToken).toBe(b.refreshToken);
    expect((await sessions.getByTokenHash(hashRefreshToken(a.refreshToken)))?.rotatedAt).toBeNull();
  });

  it("treats a rotated token presented after the window as reuse and revokes the family", async () => {
    const token = await startSession();
    const first = await service.refresh(token);
    advance(11 * 1000);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });

    const successor = await sessions.getByTokenHash(hashRefreshToken(first.refreshToken));
    expect(successor?.revokedAt).toEqual(current);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("drops the stored successor token when it detects reuse", async () => {
    const token = await startSession();
    await service.refresh(token);
    advance(11 * 1000);
    await expect(service.refresh(token)).rejects.toThrow();

    expect(
      (await sessions.getByTokenHash(hashRefreshToken(token)))?.successorCiphertext,
    ).toBeNull();
  });

  it("does not touch another family when it revokes one", async () => {
    const token = await startSession("family-1");
    const other = await startSession("family-2");
    await service.refresh(token);
    advance(11 * 1000);
    await expect(service.refresh(token)).rejects.toThrow();

    await expect(service.refresh(other)).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("rejects a missing, empty or unknown token", async () => {
    await expect(service.refresh(undefined)).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.refresh("")).rejects.toMatchObject({ statusCode: 401 });
    await expect(service.refresh("unknown")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a token that was revoked", async () => {
    const token = await startSession();
    await sessions.revokeFamily("family-1", start);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a token idle for the full idle timeout", async () => {
    const token = await startSession();
    advance(7 * DAY);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("keeps the idle timeout sliding: use pushes it back", async () => {
    let token = await startSession();
    for (let step = 0; step < 4; step++) {
      advance(6 * DAY);
      token = (await service.refresh(token)).refreshToken;
    }

    // 24 days in, far past the 7 day idle timeout counted from login.
    expect(token).toEqual(expect.any(String));
  });

  it("rejects a token past the absolute lifetime of its family, however recently used", async () => {
    let token = await startSession();
    for (let step = 0; step < 4; step++) {
      advance(6 * DAY);
      token = (await service.refresh(token)).refreshToken;
    }
    advance(6 * DAY);

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects when the user no longer exists", async () => {
    const token = await startSession();
    known = null;

    await expect(service.refresh(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("answers every rejection with the same generic message", async () => {
    const used = await startSession();
    await service.refresh(used);
    advance(11 * 1000);

    for (const token of [undefined, "unknown", used]) {
      await expect(service.refresh(token)).rejects.toThrow("Invalid refresh token.");
    }
  });
});
