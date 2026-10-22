import jwt from "jsonwebtoken";
import type { UserRole } from "@trading/domain";
import type { TokenService } from "../services/token.service.js";

/** What the gateway needs to know about a verified access token. */
export interface RealtimeIdentity {
  userId: string;
  role: UserRole;
  /** When the token stops being valid; the socket is bound to it (ADR-007 point 2). */
  expiresAt: Date;
}

/** Verifies an access token; throws for every failure. */
export type RealtimeAuthenticator = (token: string) => RealtimeIdentity;

/**
 * Authenticates a socket with the same access token service as the HTTP API,
 * so a token is valid on `/ws` exactly when it is valid on a request.
 */
export function createAccessTokenAuthenticator(
  tokens: Pick<TokenService, "verify">,
): RealtimeAuthenticator {
  return (token) => {
    const { userId, role } = tokens.verify(token);

    // `verify` already accepted the token, so it is a well-formed JWT with a numeric `exp`.
    const payload = jwt.decode(token);
    const exp = typeof payload === "object" && payload !== null ? payload.exp : undefined;
    if (typeof exp !== "number") {
      throw new Error("access token without expiry");
    }

    return { userId, role, expiresAt: new Date(exp * 1000) };
  };
}
