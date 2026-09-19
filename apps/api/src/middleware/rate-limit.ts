import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import type { AppErrorCode } from "../errors/app-error.js";

interface RateLimitErrorBody {
  error: {
    code: AppErrorCode;
    message: string;
    requestId: string;
  };
}

/**
 * Builds a 429 response handler matching the same error envelope shape
 * used everywhere else in the API (error-handler.ts /
 * 07-api-spec.md §5-6), instead of express-rate-limit's default plain
 * text body. `RATE_LIMITED` is already part of AppErrorCode.
 */
function rateLimitHandler(message: string) {
  return (req: Request, res: Response): void => {
    const body: RateLimitErrorBody = {
      error: {
        code: "RATE_LIMITED",
        message,
        requestId: req.requestId,
      },
    };
    res.status(429).json(body);
  };
}

/**
 * Applied globally to every request (see index.ts). A generous ceiling
 * meant to absorb abusive/bot traffic and protect server + database
 * resources, not to constrain normal API usage.
 *
 * In-memory store, scoped to a single process: sufficient for one API
 * instance. If the API is ever scaled to multiple instances, each
 * would track its own counters independently and the effective limit
 * would multiply — revisit with an external store (e.g. Redis) at
 * that point.
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler("Too many requests. Please try again later."),
});

/**
 * Applied specifically to POST /api/v1/auth/login, in addition to
 * generalApiRateLimiter. A tight ceiling to blunt credential-stuffing
 * and brute-force password guessing against a single IP — the login
 * service already returns a generic "Invalid credentials." error to
 * avoid account enumeration (auth.service.ts), but that alone doesn't
 * limit how many attempts a caller can make.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler("Too many login attempts. Please try again later."),
});
