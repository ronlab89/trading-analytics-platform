import { describe, expect, it, vi, afterEach } from "vitest";
import type { Request, Response } from "express";
import type { ErrorResponse } from "@trading/contracts";
import { ConflictError, ForbiddenError, NotFoundError } from "@trading/application";
import { errorHandler } from "./error-handler.js";

function run(err: unknown) {
  const json = vi.fn((_body: ErrorResponse) => undefined);
  const status = vi.fn((_code: number) => ({ json }));
  const req = { requestId: "req-1" } as unknown as Request;
  errorHandler(err, req, { status } as unknown as Response, vi.fn());
  return { status: status.mock.calls[0]?.[0], body: (json.mock.calls[0] as [ErrorResponse])[0] };
}

function named(name: string, message: string, code?: string): Error {
  const e = new Error(message);
  e.name = name;
  if (code) (e as Error & { code: string }).code = code;
  return e;
}

afterEach(() => vi.restoreAllMocks());

describe("errorHandler dependency failures", () => {
  it("maps PrismaClientInitializationError to 503 DEPENDENCY_ERROR without leaking the message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { status, body } = run(
      named("PrismaClientInitializationError", "Can't reach database server at db.internal:5432"),
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe("DEPENDENCY_ERROR");
    expect(body.error.requestId).toBe("req-1");
    expect(JSON.stringify(body)).not.toContain("db.internal");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain("request.failed");
  });

  it.each(["P1001", "P1002", "P1008", "P1017"])("maps Prisma code %s to 503", (code) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { status, body } = run(named("PrismaClientKnownRequestError", "secret host", code));
    expect(status).toBe(503);
    expect(body.error.code).toBe("DEPENDENCY_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret host");
  });

  it("keeps other Prisma errors and generic errors at 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
});
