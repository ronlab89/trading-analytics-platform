import { z } from "zod";
import type { ApiOperation } from "../api-operation.js";
import { currentUserResponseSchema, loginResponseSchema } from "../auth.response.js";
import { loginRequestSchema } from "../auth.schema.js";
import { dataEnvelope } from "../response-common.schema.js";

const REFRESH_COOKIE =
  "The refresh token, in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. It never appears in the body.";

/** The routes that read the refresh cookie demand this header (CSRF defence, ADR-005 point 7). */
const clientHeaderSchema = z.object({ "X-Requested-With": z.literal("XMLHttpRequest") });
const refreshCookieSchema = z.object({ refresh_token: z.string() });

/** Sessions and the current user (07-api-spec.md §8-§9, ADR-005). */
export const authOperations: readonly ApiOperation[] = [
  {
    operationId: "login",
    method: "post",
    path: "/api/v1/auth/login",
    tag: "Auth",
    summary: "Log in",
    description:
      "Answers the user and a short-lived access token; send the token as `Authorization: Bearer`. The endpoint has its own, stricter limit: 5 requests per 15 minutes.",
    authenticated: false,
    body: loginRequestSchema,
    success: {
      status: 200,
      description: "The user and the access token.",
      headers: { "Set-Cookie": REFRESH_COOKIE },
      schema: dataEnvelope(loginResponseSchema),
    },
    errors: [400, 401, 429],
  },
  {
    operationId: "refreshSession",
    method: "post",
    path: "/api/v1/auth/refresh",
    tag: "Auth",
    summary: "Get a new access token",
    description:
      "Reads the refresh cookie and rotates it. Reusing a refresh token that was already rotated revokes the session.",
    authenticated: false,
    headers: clientHeaderSchema,
    cookies: refreshCookieSchema,
    success: {
      status: 200,
      description: "The user and a new access token.",
      headers: { "Set-Cookie": REFRESH_COOKIE },
      schema: dataEnvelope(loginResponseSchema),
    },
    errors: [401, 403, 429],
  },
  {
    operationId: "logout",
    method: "post",
    path: "/api/v1/auth/logout",
    tag: "Auth",
    summary: "Log out",
    description: "Revokes the session of the refresh cookie and clears the cookie.",
    authenticated: false,
    headers: clientHeaderSchema,
    cookies: refreshCookieSchema,
    success: {
      status: 204,
      description: "The session was revoked.",
      headers: { "Set-Cookie": "The refresh cookie, cleared." },
    },
    errors: [403, 429],
  },
  {
    operationId: "getCurrentUser",
    method: "get",
    path: "/api/v1/auth/me",
    tag: "Auth",
    summary: "Get the current user",
    description: "Reads the user again from the database, so a role change shows at once.",
    authenticated: true,
    success: {
      status: 200,
      description: "The current user.",
      schema: dataEnvelope(currentUserResponseSchema),
    },
    errors: [401, 429],
  },
];
