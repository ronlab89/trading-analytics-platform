import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { AppError } from "../errors/app-error.js";
import { authenticate } from "./authenticate.js";
import { tokenFor } from "../test-utils/auth.js";

function run(token: string) {
  const req = { header: () => `Bearer ${token}` } as unknown as Request;
  const next = vi.fn();
  authenticate(req, {} as Response, next);
  return { req, next };
}

describe("authenticate actor", () => {
  it.each(["USER", "ADMIN"])("builds the actor from a %s token", (role) => {
    const { req, next } = run(tokenFor("u1", role));
    expect(next).toHaveBeenCalledWith();
    expect(req.actor).toEqual({ userId: "u1", role });
    expect(req.auth).toEqual({ userId: "u1", role });
  });

  it("rejects a token whose role is not a known role with the generic 401", () => {
    const { req, next } = run(tokenFor("u1", "SUPERUSER"));
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Authentication required.");
    expect(req.actor).toBeUndefined();
  });
});
