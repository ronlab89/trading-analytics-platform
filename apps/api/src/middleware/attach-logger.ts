import type { NextFunction, Request, Response } from "express";
import type { Logger } from "@trading/application";
import { withRequestContext } from "../logging/request-context.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      logger: Logger;
    }
  }
}

/**
 * Makes the logger available to the middleware and controllers of a
 * request as `req.logger`, the same way `requestId` makes the identifier
 * available as `req.requestId`. Every entry written through it carries the
 * `requestId` of the request being served (ADR-009 point 5).
 */
export function attachLogger(logger: Logger) {
  const contextual = withRequestContext(logger);
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.logger = contextual;
    next();
  };
}
