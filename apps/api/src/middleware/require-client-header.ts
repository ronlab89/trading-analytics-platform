import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

export const CLIENT_HEADER_NAME = "X-Requested-With";
export const CLIENT_HEADER_VALUE = "XMLHttpRequest";

/**
 * CSRF defence for the routes that read the refresh-token cookie
 * (ADR-005 point 7, 09-security-spec.md §23).
 *
 * The cookie is `SameSite=Strict`, and on top of that these routes demand a
 * header a plain form or navigation cannot add. From another origin a browser
 * can only add it after a CORS preflight, which the allowed-origins list
 * refuses. A request without the exact header is rejected before anything is
 * read or revoked.
 */
export function requireClientHeader(req: Request, _res: Response, next: NextFunction): void {
  if (req.header(CLIENT_HEADER_NAME) !== CLIENT_HEADER_VALUE) {
    next(new AppError("FORBIDDEN", `The ${CLIENT_HEADER_NAME} header is required.`, 403));
    return;
  }

  next();
}
