import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { ErrorResponse } from "@trading/contracts";
import {
  capturingLogger,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationFailedError,
} from "@trading/application";
import { AppError } from "../errors/app-error.js";
import { runWithRequestContext, withRequestContext } from "../logging/request-context.js";
import { errorHandler } from "./error-handler.js";

function run(err: unknown, auth?: { userId: string; role: string }) {
  const json = vi.fn((_body: ErrorResponse) => undefined);
  const status = vi.fn((_code: number) => ({ json }));
  const capture = capturingLogger();
  const req = {
    requestId: "req-1",
    logger: withRequestContext(capture),
    ...(auth ? { auth } : {}),
  } as unknown as Request;
  runWithRequestContext({ requestId: "req-1" }, () => {
    errorHandler(err, req, { status } as unknown as Response, vi.fn());
  });
  return {
    status: status.mock.calls[0]?.[0],
    body: (json.mock.calls[0] as [ErrorResponse])[0],
    entries: capture.entries,
  };
}

function named(name: string, message: string, code?: string): Error {
  const e = new Error(message);
  e.name = name;
  if (code) (e as Error & { code: string }).code = code;
  return e;
}

function bodyParserError(type: string, status: number): Error {
  return Object.assign(new Error("raw parser detail"), { type, status });
}

describe("errorHandler dependency failures", () => {
  it("maps PrismaClientInitializationError to 503 DEPENDENCY_ERROR without leaking the message", () => {
    const { status, body, entries } = run(
      named("PrismaClientInitializationError", "Can't reach database server at db.internal:5432"),
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe("DEPENDENCY_ERROR");
    expect(body.error.requestId).toBe("req-1");
    expect(JSON.stringify(body)).not.toContain("db.internal");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "error",
      event: "http.request.failed",
      fields: {
        requestId: "req-1",
        errorCategory: "DEPENDENCY_ERROR",
        status: 503,
        errorName: "PrismaClientInitializationError",
      },
    });
  });

  it.each(["P1001", "P1002", "P1008", "P1017"])("maps Prisma code %s to 503", (code) => {
    const { status, body } = run(named("PrismaClientKnownRequestError", "secret host", code));
    expect(status).toBe(503);
    expect(body.error.code).toBe("DEPENDENCY_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret host");
  });

  it("keeps other Prisma errors and generic errors at 500", () => {
    expect(run(named("PrismaClientKnownRequestError", "unique", "P2002")).status).toBe(500);
    const { status, body } = run(new Error("boom"));
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("errorHandler application errors", () => {
  it("maps NotFoundError to 404 NOT_FOUND keeping the use case message", () => {
    const { status, body } = run(new NotFoundError("The requested resource could not be found."));
    expect(status).toBe(404);
    expect(body.error).toEqual({
      code: "NOT_FOUND",
      message: "The requested resource could not be found.",
      requestId: "req-1",
    });
  });

  it("maps ConflictError to 409 CONFLICT", () => {
    const { status, body } = run(new ConflictError("The portfolio is archived."));
    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("The portfolio is archived.");
  });

  it("maps ForbiddenError to 403 FORBIDDEN", () => {
    const { status, body } = run(new ForbiddenError("Missing permission: portfolio:write."));
    expect(status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("maps ValidationFailedError to 400 VALIDATION_ERROR keeping its field details", () => {
    const details = [{ field: "changes", code: "UNKNOWN_ASSET", message: "Unknown asset: a1" }];
    const { status, body } = run(
      new ValidationFailedError("The scenario references assets that do not exist.", details),
    );
    expect(status).toBe(400);
    expect(body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "The scenario references assets that do not exist.",
      requestId: "req-1",
      details,
    });
  });
});

describe("errorHandler authz.denied (ADR-009 point 9)", () => {
  const viewer = { userId: "user-1", role: "VIEWER" };

  it("logs authz.denied at warn with the user, the role and the missing permission", () => {
    const { status, entries } = run(
      new ForbiddenError("Missing permission: portfolio:write.", "portfolio:write"),
      viewer,
    );

    expect(status).toBe(403);
    expect(entries.map((entry) => entry.event)).toEqual(["http.request.failed", "authz.denied"]);
    expect(entries[1]).toEqual({
      level: "warn",
      event: "authz.denied",
      fields: {
        requestId: "req-1",
        userId: "user-1",
        role: "VIEWER",
        permission: "portfolio:write",
      },
    });
  });

  it("logs nothing extra for a ForbiddenError that names no permission", () => {
    const { entries } = run(new ForbiddenError("Not yours."), viewer);

    expect(entries.map((entry) => entry.event)).toEqual(["http.request.failed"]);
  });

  it("still logs the denial when the request carries no authentication", () => {
    const { entries } = run(new ForbiddenError("Missing permission: alert:write.", "alert:write"));

    expect(entries[1]?.fields).toEqual({ requestId: "req-1", permission: "alert:write" });
  });

  it("does not log authz.denied for other failures", () => {
    const { entries } = run(
      new NotFoundError("The requested resource could not be found."),
      viewer,
    );

    expect(entries.map((entry) => entry.event)).toEqual(["http.request.failed"]);
  });
});

describe("errorHandler logging by category (ADR-009 point 6)", () => {
  it.each([
    ["an AppError VALIDATION_ERROR", new AppError("VALIDATION_ERROR", "Bad input.", 400), "warn"],
    ["an AppError UNAUTHORIZED", new AppError("UNAUTHORIZED", "Missing token.", 401), "warn"],
    ["an AppError FORBIDDEN", new AppError("FORBIDDEN", "Not allowed.", 403), "warn"],
    ["an AppError RATE_LIMITED", new AppError("RATE_LIMITED", "Slow down.", 429), "warn"],
    ["an AppError NOT_FOUND", new AppError("NOT_FOUND", "No route.", 404), "info"],
    ["an AppError CONFLICT", new AppError("CONFLICT", "Already there.", 409), "info"],
    ["a ForbiddenError", new ForbiddenError("Missing permission: portfolio:write."), "warn"],
    ["a NotFoundError", new NotFoundError("The requested resource could not be found."), "info"],
    ["a ConflictError", new ConflictError("The portfolio is archived."), "info"],
    ["a ValidationFailedError", new ValidationFailedError("Invalid.", []), "warn"],
    ["a malformed body", bodyParserError("entity.parse.failed", 400), "warn"],
    ["an oversized body", bodyParserError("entity.too.large", 413), "warn"],
    ["a domain Invalid*Error", named("InvalidPortfolioError", "Name is required."), "warn"],
  ])("logs %s once at %s, without a stack", (_name, err, level) => {
    const { entries } = run(err);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe(level);
    expect(entries[0]?.event).toBe("http.request.failed");
    expect(entries[0]?.fields).toHaveProperty("requestId", "req-1");
    expect(entries[0]?.fields).not.toHaveProperty("stack");
    expect(entries[0]?.fields).not.toHaveProperty("errorName");
  });

  it("carries the response code as errorCategory and the response status as status", () => {
    const { entries } = run(new ConflictError("The portfolio is archived."));

    expect(entries[0]?.fields).toMatchObject({
      errorCategory: "CONFLICT",
      status: 409,
      message: "The portfolio is archived.",
    });
  });

  it("logs the client-facing message of a malformed body, not the parser detail", () => {
    const { entries } = run(bodyParserError("entity.parse.failed", 400));

    expect(entries[0]?.fields).toMatchObject({ message: "The request body is not valid JSON." });
    expect(JSON.stringify(entries)).not.toContain("raw parser detail");
  });

  it("logs an unexpected error at error with the raw message, errorName and stack", () => {
    const boom = new TypeError("boom: raw detail");
    const { status, entries } = run(boom);

    expect(status).toBe(500);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "error",
      event: "http.request.failed",
      fields: {
        requestId: "req-1",
        errorCategory: "INTERNAL_ERROR",
        status: 500,
        message: "boom: raw detail",
        errorName: "TypeError",
        stack: boom.stack,
      },
    });
  });

  it("logs a dependency failure with its stack", () => {
    const failure = named("PrismaClientInitializationError", "Can't reach database server");
    const { entries } = run(failure);

    expect(entries[0]?.level).toBe("error");
    expect(entries[0]?.fields).toMatchObject({
      errorCategory: "DEPENDENCY_ERROR",
      stack: failure.stack,
    });
  });

  it("logs a thrown non-Error value as UnknownError", () => {
    const { status, entries } = run("just a string");

    expect(status).toBe(500);
    expect(entries[0]?.fields).toMatchObject({
      errorCategory: "INTERNAL_ERROR",
      message: "just a string",
      errorName: "UnknownError",
    });
  });

  it("never puts the stack, the raw message or the error name in the response", () => {
    const boom = new TypeError("boom: raw detail");
    const { body } = run(boom);
    const raw = JSON.stringify(body);

    expect(body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: "req-1",
    });
    expect(raw).not.toContain("boom: raw detail");
    expect(raw).not.toContain("TypeError");
    expect(raw).not.toContain(" at ");
  });
});
