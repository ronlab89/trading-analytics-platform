import { createHash, randomBytes } from "node:crypto";

/**
 * The refresh token is an opaque random value; the server keeps only its
 * hash (ADR-005 point 5). It travels in an `HttpOnly` cookie scoped to the
 * auth routes.
 */
export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** 256 bits of randomness, URL-safe. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 is enough here: the input is 256 random bits, so there is nothing
 * to brute-force and a slow hash would only cost every refresh.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
