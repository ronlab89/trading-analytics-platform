import { describe, expect, it } from "vitest";
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError } from "./errors.js";

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

  // error-handler.ts classifies domain errors by this name pattern. An
  // application error that matched it would be reported as a 400.
  it("no application error name matches the domain-error pattern of the HTTP error handler", () => {
    for (const error of [new NotFoundError("x"), new ConflictError("x"), new ForbiddenError("x")]) {
      expect(error.name).not.toMatch(/^(Invalid|Insufficient).+Error$/);
    }
  });
});
