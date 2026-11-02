import { ApiError } from "./trading-client";

/** The codes with which the API says it understood the request and refused it. */
const REJECTIONS = new Set(["VALIDATION_ERROR", "CONFLICT", "NOT_FOUND"]);

/**
 * Why the API refused a request, in its own words, or null when the failure says nothing about the
 * request: a dropped connection, a timeout, a server error. A refusal is final (selling more than
 * is held, changing an archived portfolio), so the user needs the reason and trying again cannot
 * help; any other failure keeps the generic "check your connection" text.
 */
export function rejectionReason(error: unknown): string | null {
  return error instanceof ApiError && REJECTIONS.has(error.code) ? error.message : null;
}
