import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

const base = { JWT_SECRET: "x".repeat(32) };

function parseCors(value?: string) {
  return envSchema.safeParse({ ...base, ...(value === undefined ? {} : { CORS_ORIGIN: value }) });
}

describe("envSchema CORS_ORIGIN", () => {
  it("defaults to the local web origin", () => {
    const result = parseCors();
    expect(result.success && result.data.CORS_ORIGIN).toEqual(["http://localhost:5173"]);
  });

  it("accepts http and https origins with optional port", () => {
    const result = parseCors("http://localhost:5173, https://app.example.com");
    expect(result.success && result.data.CORS_ORIGIN).toEqual([
      "http://localhost:5173",
      "https://app.example.com",
    ]);
  });

  it.each([
    "*",
    "http://*.example.com",
    "example.com",
    "ftp://example.com",
    "https://a.com/path",
    "https://a.com,*",
  ])("rejects %s", (value) => {
    expect(parseCors(value).success).toBe(false);
  });
});
