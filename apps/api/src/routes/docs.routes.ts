import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { apiReference } from "@scalar/express-api-reference";
import { API_OPERATIONS, buildOpenApiDocument } from "@trading/contracts";

export const OPENAPI_PATH = "/openapi.json";
export const DOCS_PATH = "/api/docs";

/** Scalar's own CDN, used when `API_DOCS_CDN_URL` is not set. */
export const DEFAULT_VIEWER_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";

const DESCRIPTION = [
  "The HTTP API of the trading analytics platform.",
  "",
  "Every `/api/v1` endpoint except the login, the refresh and the logout needs the access token: choose **bearerAuth** and paste the token that `POST /api/v1/auth/login` returns. Failures use one error envelope.",
  "",
  "The live market stream is a WebSocket and is not part of this document; see `docs/08-realtime-spec.md`.",
].join("\n");

export interface DocsOptions {
  /** Where the viewer loads its script from; Scalar's CDN when omitted. */
  readonly cdnUrl?: string | undefined;
}

/**
 * The CSP of the viewer page alone. Everything else keeps the strict policy of
 * `helmet()`: this page needs a script from the CDN, inline styles and a
 * nonce for the two inline scripts that start the viewer. No `unsafe-eval`
 * and no inline script without the nonce.
 */
function viewerPolicy(nonce: string, cdnUrl: string): string {
  const cdnOrigin = new URL(cdnUrl).origin;
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' ${cdnOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${cdnOrigin}`,
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Serves the OpenAPI document generated from `API_OPERATIONS` and the Scalar
 * viewer that reads it. They are not API routes: the document does not list
 * them. `createApp()` mounts this router only when the docs are enabled
 * (`API_DOCS_ENABLED`), so with them off both paths answer the normal 404.
 */
export function createDocsRouter(options: DocsOptions = {}): ExpressRouter {
  const router = Router();
  const cdnUrl = options.cdnUrl ?? DEFAULT_VIEWER_CDN;
  const document = buildOpenApiDocument(API_OPERATIONS, {
    title: "Trading Analytics API",
    version: "1.0.0",
    description: DESCRIPTION,
  });

  router.get(OPENAPI_PATH, (_req, res) => {
    res.json(document);
  });

  router.get(DOCS_PATH, (req, res, next) => {
    const nonce = randomBytes(16).toString("base64");
    res.setHeader("Content-Security-Policy", viewerPolicy(nonce, cdnUrl));

    // A new handler per request because the nonce must be new for each page.
    apiReference({
      url: OPENAPI_PATH,
      pageTitle: "Trading Analytics API",
      cdn: cdnUrl,
      nonce,
      withDefaultFonts: false,
    })(req as never, res as never, next);
  });

  return router;
}
