import { createHash } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IdempotencyService } from "@trading/application";
import { AppError } from "../errors/app-error.js";
import { actorOf } from "./authenticate.js";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Printable ASCII with no space, 1 to 255 characters (the domain limit). */
const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

/** The key a request runs under, set by the middleware for the handler to store its response. */
export interface RequestIdempotency {
  readonly userId: string;
  readonly key: string;
}

/** The idempotency of this request, or undefined when it carries no `Idempotency-Key`. */
export function idempotencyOf(res: Response): RequestIdempotency | undefined {
  return res.locals.idempotency as RequestIdempotency | undefined;
}

/** JSON with the keys of every object sorted, so the same body always hashes the same. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Hash of the request: method, route pattern, path parameters and body
 * (ADR-008 Deferred detail), so the same key and body sent to another
 * portfolio is a different request.
 */
export function hashRequest(req: Request): string {
  const routePath = (req.route as { path?: unknown } | undefined)?.path;
  const route = typeof routePath === "string" ? routePath : req.path;

  return createHash("sha256")
    .update(canonicalJson([req.method, route, req.params, req.body]))
    .digest("hex");
}

/**
 * `Idempotency-Key` support (ADR-008 point 8).
 *
 * Without the header the request runs untouched. With it, the key is reserved
 * before the handler runs; a repeat of a finished request is answered with the
 * stored response (`Idempotency-Replayed: true`), the same key with another
 * request, or while the first still runs, is a 409.
 *
 * The handler stores a success in the unit of work of its mutation, so the key
 * and the change commit together. Anything the handler did not store is settled
 * here just before the response goes out: a 4xx is stored (nothing was
 * changed, and the same request keeps getting the same answer), a 5xx is
 * released and never stored. Storing resolves false for a key the unit of work
 * already completed, which is the normal success path.
 *
 * Place it after `authenticate` and after the body parser of the route.
 */
export function idempotency(
  service: Pick<IdempotencyService, "begin" | "complete" | "release">,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.get(IDEMPOTENCY_HEADER);

    if (key === undefined) {
      next();
      return;
    }

    if (!KEY_PATTERN.test(key)) {
      next(
        new AppError("VALIDATION_ERROR", "The request contains an invalid Idempotency-Key.", 400, [
          {
            field: IDEMPOTENCY_HEADER,
            code: "invalid_string",
            message: "Must be 1-255 printable characters with no spaces.",
          },
        ]),
      );
      return;
    }

    const { userId } = actorOf(req);

    service
      .begin({ userId, key, requestHash: hashRequest(req) })
      .then((decision) => {
        if (decision.kind === "replay") {
          res.setHeader("Idempotency-Replayed", "true");
          res.status(decision.status).json(decision.body);
          return;
        }

        res.locals.idempotency = { userId, key } satisfies RequestIdempotency;

        const send = res.json.bind(res);
        res.json = (body: unknown): Response => {
          const settle =
            res.statusCode >= 500
              ? service.release(userId, key)
              : service
                  .complete({ userId, key, responseStatus: res.statusCode, responseBody: body })
                  .then(() => undefined);

          // A failure to settle must not stop the response; the lease frees the key.
          settle.catch(() => undefined).finally(() => send(body));

          return res;
        };

        next();
      })
      .catch(next);
  };
}
