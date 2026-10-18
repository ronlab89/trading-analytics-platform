import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../services/refresh-token.js";

/**
 * The refresh-token cookie (ADR-005 point 5, 09-security-spec.md §8). The
 * clearing options must repeat the path and flags the cookie was set with, or
 * the browser keeps it.
 */
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: REFRESH_COOKIE_PATH,
};

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: env.SESSION_ABSOLUTE_SECONDS * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_OPTIONS);
}

/** Reads the refresh token from the `Cookie` header; undefined when it is not there. */
export function readRefreshCookie(req: Request): string | undefined {
  for (const pair of (req.header("Cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");

    if (separator !== -1 && pair.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      return pair.slice(separator + 1).trim() || undefined;
    }
  }

  return undefined;
}
