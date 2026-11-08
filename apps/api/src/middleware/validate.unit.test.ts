import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Request, Response } from "express";
import { validate, validationOf } from "./validate.js";
import type { AppError } from "../errors/app-error.js";

describe("validate details", () => {
  it("includes the Zod issue code, and custom for refine", () => {
    const schema = z
      .object({ qty: z.number().min(1), a: z.string() })
      .refine((v) => v.a !== "x", { message: "bad a", path: ["a"] });
    const next = vi.fn();
    validate(schema, "body")({ body: { qty: 0, a: "ok" } } as Request, {} as Response, next);
    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err.details).toEqual([
      { field: "qty", code: "too_small", message: "Too small: expected number to be >=1" },
    ]);

    const next2 = vi.fn();
    validate(schema, "body")({ body: { qty: 5, a: "x" } } as Request, {} as Response, next2);
    expect((next2.mock.calls[0]?.[0] as AppError).details).toEqual([
      { field: "a", code: "custom", message: "bad a" },
    ]);
  });

  it("validates route params with a params-specific message and stores them", () => {
    const schema = z.object({ portfolioId: z.string().max(3) });
    const next = vi.fn();
    validate(schema, "params")(
      { params: { portfolioId: "toolong" } } as unknown as Request,
      {} as Response,
      next,
    );
    const err = next.mock.calls[0]?.[0] as AppError;
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("The request contains invalid route parameters.");
    expect(err.details?.[0]).toMatchObject({ field: "portfolioId", code: "too_big" });

    const req = { params: { portfolioId: "ok" } } as unknown as Request;
    const next2 = vi.fn();
    validate(schema, "params")(req, {} as Response, next2);
    expect(next2).toHaveBeenCalledWith();
    expect(req.validated?.params).toEqual({ portfolioId: "ok" });
  });
});

describe("validationOf", () => {
  it("returns the schema and source a validate() middleware checks", () => {
    const schema = z.object({ id: z.string() });

    expect(validationOf(validate(schema, "params"))).toEqual({ schema, source: "params" });
  });

  it("returns undefined for any other handler", () => {
    expect(validationOf((): void => undefined)).toBeUndefined();
    expect(validationOf("not a function")).toBeUndefined();
    expect(validationOf(undefined)).toBeUndefined();
  });

  it("does not change what validate() does", () => {
    const next = vi.fn();
    validate(z.object({ n: z.coerce.number() }), "query")(
      { query: { n: "3" } } as unknown as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith();
  });
});
