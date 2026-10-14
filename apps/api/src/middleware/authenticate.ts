import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Actor } from "@trading/application";
import { UserRole } from "@trading/domain";
import { AppError } from "../errors/app-error.js";
import { env } from "../config/env.js";

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

interface AccessTokenPayload {
  sub: string;
  role: string;
}

function isUserRole(role: string): role is UserRole {
  return (Object.values(UserRole) as string[]).includes(role);
}

function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).sub === "string" &&
    typeof (payload as Record<string, unknown>).role === "string"
  );
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
    const payload: unknown = jwt.verify(token, env.JWT_SECRET);

    if (!isAccessTokenPayload(payload) || !isUserRole(payload.role)) {
      next(new AppError("UNAUTHORIZED", "Authentication required.", 401));
      return;
    }

    req.auth = { userId: payload.sub, role: payload.role };
    req.actor = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Authentication required.", 401));
  }
}
