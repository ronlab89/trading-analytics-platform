import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/trading-client";
import { classifyLoginFailure } from "./classify-login-failure";

describe("classifyLoginFailure", () => {
  it("reads a 401 as wrong credentials", () => {
    expect(classifyLoginFailure(new ApiError("UNAUTHORIZED", "Nope", 401))).toBe("credentials");
  });

  it("reads a 429 as too many attempts", () => {
    expect(classifyLoginFailure(new ApiError("RATE_LIMITED", "Slow down", 429))).toBe(
      "rate-limited",
    );
  });

  it.each([
    new ApiError("INTERNAL_ERROR", "Boom", 500),
    new ApiError("DEPENDENCY_ERROR", "Down", 503),
    new ApiError("NETWORK_ERROR", "Offline"),
    new ApiError("TIMEOUT", "Slow"),
    new ApiError("INVALID_RESPONSE", "Odd"),
    new ApiError("VALIDATION_ERROR", "Bad body", 400),
    new Error("anything else"),
  ])("reads %o as the service being unavailable", (error) => {
    expect(classifyLoginFailure(error)).toBe("unavailable");
  });
});
