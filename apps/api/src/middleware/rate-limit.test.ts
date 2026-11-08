import { describe, expect, it } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { capturingLogger } from "@trading/application";
import { attachLogger } from "./attach-logger.js";
import { requestId } from "./request-id.js";
import { rateLimitHandler } from "./rate-limit.js";

/**
 * Isolated unit test for the rate-limit response shape/behavior.
 *
 * Deliberately does NOT test `generalApiRateLimiter`/`loginRateLimiter`
 * directly: those are disabled under NODE_ENV=test (see rate-limit.ts)
 * so the rest of the integration suite can run many requests without
 * tripping a shared IP-based counter. This test builds its own minimal
 * Express app with a tiny, independent limiter — reusing the same
 * `rateLimitHandler` the real limiters use — so the 429 behavior is
 * still verified without that trade-off.
 */
describe("rate limiting", () => {
  it("returns 429 with the normalized error envelope once the limit is exceeded", async () => {
    const logger = capturingLogger();
    const app = express();
    app.use(requestId);
    app.use(attachLogger(logger));
    app.get(
      "/limited",
      rateLimit({
        windowMs: 60_000,
        limit: 2,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        handler: rateLimitHandler("Too many requests. Please try again later."),
      }),
      (_req, res) => {
        res.json({ ok: true });
      },
    );

    const first = await request(app).get("/limited");
    const second = await request(app).get("/limited");
    const third = await request(app).get("/limited");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);

    const thirdBody = third.body as { error: { code: string; requestId: string } };
    expect(thirdBody.error.code).toBe("RATE_LIMITED");
    expect(thirdBody.error.requestId).toEqual(expect.any(String));

    // Only the rejected request is logged, at warn (ADR-009 point 6).
    expect(logger.entries).toEqual([
      {
        level: "warn",
        event: "http.request.failed",
        fields: {
          requestId: thirdBody.error.requestId,
          errorCategory: "RATE_LIMITED",
          status: 429,
          message: "Too many requests. Please try again later.",
        },
      },
    ]);
  });
});
