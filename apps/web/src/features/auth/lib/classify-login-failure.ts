import { ApiError } from "@/api/trading-client";

export type LoginFailure = "credentials" | "rate-limited" | "unavailable";

/** What the user can do about a failed login: fix the data, wait, or try again later. */
export function classifyLoginFailure(error: unknown): LoginFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) return "credentials";
    if (error.status === 429) return "rate-limited";
  }
  return "unavailable";
}
