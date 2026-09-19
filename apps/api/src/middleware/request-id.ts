import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "X-Request-ID";

// Conservative allowlist: safe to log, safe to echo back, bounded length.
// Rejects anything that doesn't look like a UUID/short token instead of
// trusting arbitrary client-supplied header content.
const SAFE_REQUEST_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a request identifier to every incoming request and exposes it
 * back to the client via the X-Request-ID response header.
 *
 * If the client supplies a value, it is reused as-is for correlation
 * convenience; otherwise a new UUID is generated. See
 * 13-observability-spec.md §9 for the correlation strategy this
 * middleware implements.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && SAFE_REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}
