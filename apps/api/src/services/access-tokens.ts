import { systemClock } from "../clock.js";
import { env } from "../config/env.js";
import { createTokenService } from "./token.service.js";

/**
 * The access token service of the running API: the configured secret and
 * lifetime, and the system clock. Login signs with it and `authenticate`
 * verifies with it.
 */
export const accessTokens = createTokenService({
  secret: env.JWT_SECRET,
  ttlSeconds: env.JWT_EXPIRES_IN_SECONDS,
  clock: systemClock,
});
