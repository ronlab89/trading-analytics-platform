import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { AppError } from "../errors/app-error.js";
import { requireClientHeader } from "./require-client-header.js";

function run(value: string | undefined) {
  const req = { header: () => value } as unknown as Request;
  const next = vi.fn();
  requireClientHeader(req, {} as Response, next);
  return next;
}

describe("requireClientHeader", () => {
  it("lets a request with the header through", () => {
    expect(run("XMLHttpRequest")).toHaveBeenCalledWith();
  });

  it.each([undefined, "", "xmlhttprequest", "fetch"])(
    "rejects the value %j with a 403 and does not continue",
    (value) => {
      const next = run(value);
      const error = next.mock.calls[0]?.[0] as AppError;

      expect(next).toHaveBeenCalledOnce();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.message).toBe("The X-Requested-With header is required.");
    },
  );
});
