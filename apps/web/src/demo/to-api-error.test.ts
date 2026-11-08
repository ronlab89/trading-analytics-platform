import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "@trading/application";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/trading-client";
import { toApiError } from "./to-api-error";

class InvalidPortfolioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPortfolioError";
  }
}

class InsufficientPositionQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPositionQuantityError";
  }
}

describe("toApiError", () => {
  it("answers a missing resource as 404 NOT_FOUND with its message", () => {
    const error = toApiError(new NotFoundError("Portfolio not found."));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Portfolio not found.",
    });
  });

  it("answers a conflict as 409 CONFLICT", () => {
    expect(toApiError(new ConflictError("The portfolio is archived."))).toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("answers a missing permission as 403 FORBIDDEN without naming the permission", () => {
    const error = toApiError(new ForbiddenError("Not allowed.", "portfolio:write"));

    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403, message: "Not allowed." });
    expect(JSON.stringify(error)).not.toContain("portfolio:write");
  });

  it("answers a rejected value as 400 VALIDATION_ERROR with one detail per field", () => {
    const issue = { field: "assetId", code: "UNKNOWN_ASSET", message: "No such asset." };
    const error = toApiError(new ValidationFailedError("Invalid request.", [issue]));

    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400, details: [issue] });
  });

  it("answers a broken domain rule, including an oversell, as 400 VALIDATION_ERROR", () => {
    expect(toApiError(new InvalidPortfolioError("The name is empty."))).toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "The name is empty.",
    });
    expect(toApiError(new InsufficientPositionQuantityError("Not enough shares."))).toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("keeps an ApiError as it is", () => {
    const original = new ApiError("UNAUTHORIZED", "No session.", 401);

    expect(toApiError(original)).toBe(original);
  });

  it("hides anything else behind a generic 500", () => {
    const error = toApiError(new TypeError("Cannot read properties of undefined"));

    expect(error).toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "An unexpected error occurred.",
    });
  });
});
