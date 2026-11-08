import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorDetailSchema, errorResponseSchema } from "./error.schema.js";

describe("error schemas", () => {
  it("lists DEPENDENCY_ERROR and not TIMEOUT", () => {
    expect(ERROR_CODES).toContain("DEPENDENCY_ERROR");
    expect(ERROR_CODES).not.toContain("TIMEOUT");
  });

  it("accepts an envelope with and without details", () => {
    const base = { code: "NOT_FOUND", message: "x", requestId: "r1" };
    expect(errorResponseSchema.safeParse({ error: base }).success).toBe(true);
    expect(
      errorResponseSchema.safeParse({
        error: { ...base, details: [{ field: "a", code: "too_small", message: "m" }] },
      }).success,
    ).toBe(true);
  });

  it("rejects an envelope without requestId or with an unknown code", () => {
    expect(
      errorResponseSchema.safeParse({ error: { code: "NOT_FOUND", message: "x" } }).success,
    ).toBe(false);
    expect(
      errorResponseSchema.safeParse({ error: { code: "TIMEOUT", message: "x", requestId: "r" } })
        .success,
    ).toBe(false);
  });

  it("requires field, code and message on a detail", () => {
    expect(errorDetailSchema.safeParse({ field: "a", message: "m" }).success).toBe(false);
  });
});
