import { describe, expect, it } from "vitest";
import { rejectionReason } from "./rejection-reason";
import { ApiError } from "./trading-client";

describe("rejectionReason", () => {
  it.each(["VALIDATION_ERROR", "CONFLICT", "NOT_FOUND"] as const)(
    "gives the API's own message for a %s",
    (code) => {
      expect(rejectionReason(new ApiError(code, "The reason.", 409))).toBe("The reason.");
    },
  );

  it.each(["NETWORK_ERROR", "TIMEOUT", "INTERNAL_ERROR", "DEPENDENCY_ERROR"] as const)(
    "gives nothing for a %s, which says nothing about the request",
    (code) => {
      expect(rejectionReason(new ApiError(code, "x"))).toBeNull();
    },
  );

  it("gives nothing for what is not an ApiError", () => {
    expect(rejectionReason(new Error("boom"))).toBeNull();
    expect(rejectionReason(undefined)).toBeNull();
  });
});
