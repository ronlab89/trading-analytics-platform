import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  PrismaUserRepository,
  PrismaCredentialRepository,
  PrismaSessionRepository,
} from "@trading/database";
import { validateNewSession, type UserRole } from "@trading/domain";
import { systemClock } from "../clock.js";
import { AppError } from "../errors/app-error.js";
import { env } from "../config/env.js";
import { accessTokens } from "./access-tokens.js";
import { generateRefreshToken, hashRefreshToken } from "./refresh-token.js";

const userRepository = new PrismaUserRepository();
const credentialRepository = new PrismaCredentialRepository();
const sessionRepository = new PrismaSessionRepository();

// Valid cost-10 bcrypt hash of a throwaway string; matches the cost used for real credentials.
const DUMMY_PASSWORD_HASH = "$2b$10$Le7YhguWSoEFRnQTg4pPseKriO.5s8SiKua23Q6yYD4Rx47z8bqZS";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface LoginResult {
  user: AuthenticatedUser & { role: UserRole };
  accessToken: string;
  /** When the access token expires. */
  expiresAt: Date;
  /** The opaque refresh token; only its hash is stored. Sent as a cookie, never in the body. */
  refreshToken: string;
}

/**
 * Verifies email/password, issues a short-lived access token and starts a
 * session whose refresh token is stored only as a hash (ADR-005 points 4-5).
 *
 * Always throws the same generic "Invalid credentials." error whether the
 * email doesn't exist, has no credential, or the password is wrong — this
 * avoids account enumeration (09-security-spec.md §51).
 *
 * JWT payload follows 09-security-spec.md §6: only `sub` (userId) and
 * `role` — never anything sensitive.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await userRepository.getByEmail(email);
  const credential = user ? await credentialRepository.getByUserId(user.id) : null;

  // Always run one bcrypt comparison, against a dummy hash when the account or
  // credential is missing, so response time doesn't reveal which emails exist.
  const passwordMatches = await bcrypt.compare(
    password,
    credential?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !credential || !passwordMatches) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials.", 401);
  }

  const { accessToken, expiresAt } = accessTokens.issue({ userId: user.id, role: user.role });

  const refreshToken = generateRefreshToken();
  const session = {
    userId: user.id,
    familyId: randomUUID(),
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(systemClock.now().getTime() + env.SESSION_ABSOLUTE_SECONDS * 1000),
  };
  validateNewSession(session);
  await sessionRepository.create(session);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
    accessToken,
    expiresAt,
    refreshToken,
  };
}

/**
 * Resolves the current authenticated user's fresh data from the database
 * given a userId already verified by the `authenticate` middleware.
 *
 * Refetches rather than trusting the JWT payload alone, so a role change
 * (or account removal) made after the token was issued is reflected
 * immediately — the JWT only proves identity, the database remains the
 * authorization source of truth (09-security-spec.md §11).
 */
export async function getCurrentUser(userId: string): Promise<AuthenticatedUser> {
  const user = await userRepository.getById(userId);

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Authentication required.", 401);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}
