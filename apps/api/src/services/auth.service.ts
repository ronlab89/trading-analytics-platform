import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaUserRepository, PrismaCredentialRepository } from "@trading/database";
import { AppError } from "../errors/app-error.js";
import { env } from "../config/env.js";

const userRepository = new PrismaUserRepository();
const credentialRepository = new PrismaCredentialRepository();

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
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
