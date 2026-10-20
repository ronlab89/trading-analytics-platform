import { PrismaSessionRepository, PrismaUserRepository } from "@trading/database";
import { systemClock } from "../clock.js";
import { env } from "../config/env.js";
import { logger } from "../logging/logger.js";
import { withRequestContext } from "../logging/request-context.js";
import { accessTokens } from "./access-tokens.js";
import { createGraceTokenCipher } from "./grace-token-cipher.js";
import { createLogoutService } from "./logout.service.js";
import { createRefreshService } from "./refresh.service.js";

const sessions = new PrismaSessionRepository();

/**
 * The refresh and logout services of the running API: the database
 * repositories, the configured secret and idle timeout, and the system clock.
 */
export const refreshService = createRefreshService({
  sessions,
  users: new PrismaUserRepository(),
  accessTokens,
  graceCipher: createGraceTokenCipher(env.JWT_SECRET),
  clock: systemClock,
  idleSeconds: env.SESSION_IDLE_SECONDS,
  logger: withRequestContext(logger),
});

export const logoutService = createLogoutService({ sessions, clock: systemClock });
