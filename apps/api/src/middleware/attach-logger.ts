import type { NextFunction, Request, Response } from "express";
import type { Logger } from "@trading/application";

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
 * available as `req.requestId`.
 */
export function attachLogger(logger: Logger) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.logger = logger;
    next();
  };
}
