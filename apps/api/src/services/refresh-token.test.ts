import { describe, expect, it } from "vitest";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token.js";

describe("refresh token", () => {
  it("generates a distinct URL-safe token of 256 bits every time", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes to a stable 64-character hex digest that is not the token", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hash);
  });
});
