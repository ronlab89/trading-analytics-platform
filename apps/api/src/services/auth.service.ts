import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaUserRepository, PrismaCredentialRepository } from "@trading/database";
import { AppError } from "../errors/app-error.js";
import { env } from "../config/env.js";

const userRepository = new PrismaUserRepository();
const credentialRepository = new PrismaCredentialRepository();

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface LoginResult {
  user: AuthenticatedUser;
  token: string;
}

/**
 * Verifies email/password and issues a signed JWT session.
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

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials.", 401);
  }

  const credential = await credentialRepository.getByUserId(user.id);

  if (!credential) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials.", 401);
  }

  const passwordMatches = await bcrypt.compare(password, credential.passwordHash);

  if (!passwordMatches) {
    throw new AppError("UNAUTHORIZED", "Invalid credentials.", 401);
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
    token,
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
