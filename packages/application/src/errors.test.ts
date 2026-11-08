import { describe, expect, it } from "vitest";
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "./errors.js";

describe("application errors", () => {
  it.each([
    ["NotFoundError", new NotFoundError("The requested resource could not be found.")],
    ["ConflictError", new ConflictError("The portfolio is archived.")],
    ["ForbiddenError", new ForbiddenError("Missing permission.")],
  ])("%s is an ApplicationError that keeps its message", (name, error) => {
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
    expect(error.message).not.toBe("");
  });

  it("the three kinds are distinguishable", () => {
    expect(new NotFoundError("x")).not.toBeInstanceOf(ConflictError);
    expect(new ConflictError("x")).not.toBeInstanceOf(ForbiddenError);
  });

  it("ValidationFailedError is an ApplicationError that keeps its message and field details", () => {
    const details = [{ field: "changes", code: "UNKNOWN_ASSET", message: "Unknown asset: a1" }];
    const error = new ValidationFailedError(
      "The scenario references assets that do not exist.",
      details,
    );
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe("ValidationFailedError");
    expect(error.message).toBe("The scenario references assets that do not exist.");
    expect(error.details).toEqual(details);
  });

  // error-handler.ts classifies domain errors by this name pattern. An
  // application error that matched it would be reported as a 400.
  it("no application error name matches the domain-error pattern of the HTTP error handler", () => {
    for (const error of [
      new NotFoundError("x"),
      new ConflictError("x"),
      new ForbiddenError("x"),
      new ValidationFailedError("x", []),
    ]) {
      expect(error.name).not.toMatch(/^(Invalid|Insufficient).+Error$/);
    }
  });
});
