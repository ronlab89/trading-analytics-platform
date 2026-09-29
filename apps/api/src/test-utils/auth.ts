import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Signs an access token the same way auth.service.ts does, bypassing
 * HTTP login so integration tests can act as a given user directly.
 */
export function tokenFor(userId: string, role = "USER"): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
  });
}
