import type { NextFunction, Request, Response } from "express";
import type { Actor } from "@trading/application";
import { AppError } from "../errors/app-error.js";
import { accessTokens } from "../services/access-tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: {
        userId: string;
        role: string;
      };
      /** Built from the verified token; what the application layer receives. */
      actor?: Actor;
    }
  }
}

/** The authenticated actor of a request that went through `authenticate`. */
export function actorOf(req: Request): Actor {
  if (!req.actor) {
    throw new AppError("UNAUTHORIZED", "Authentication required.", 401);
  }
  return req.actor;
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded identity to req.auth for downstream handlers.
 *
 * Rejects with a single generic 401 for every failure case — missing
 * header, malformed header, invalid signature, expired token, or
 * malformed payload — never revealing which one applies
 * (09-security-spec.md §17: avoid exposing unnecessary authorization
 * details).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    next(new AppError("UNAUTHORIZED", "Authentication required.", 401));
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const { userId, role } = accessTokens.verify(token);

    req.auth = { userId, role };
    req.actor = { userId, role };
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Authentication required.", 401));
  }
}
