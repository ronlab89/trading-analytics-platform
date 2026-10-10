import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Request, Response } from "express";
import { validate } from "./validate.js";
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
});
