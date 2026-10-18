import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

const base = { JWT_SECRET: "x".repeat(32) };

function parseCors(value?: string) {
  return envSchema.safeParse({ ...base, ...(value === undefined ? {} : { CORS_ORIGIN: value }) });
}

describe("envSchema session lifetimes", () => {
  it("defaults to a 7-day idle timeout and a 30-day absolute lifetime", () => {
    const result = envSchema.safeParse(base);

    expect(result.success && result.data.SESSION_IDLE_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(result.success && result.data.SESSION_ABSOLUTE_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it("reads the lifetimes from the environment", () => {
    const result = envSchema.safeParse({
      ...base,
      SESSION_IDLE_SECONDS: "3600",
      SESSION_ABSOLUTE_SECONDS: "86400",
    });

    expect(result.success && result.data.SESSION_IDLE_SECONDS).toBe(3600);
    expect(result.success && result.data.SESSION_ABSOLUTE_SECONDS).toBe(86400);
  });

  it.each(["0", "-1", "1.5", "soon"])("rejects %s as a lifetime", (value) => {
    expect(envSchema.safeParse({ ...base, SESSION_IDLE_SECONDS: value }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, SESSION_ABSOLUTE_SECONDS: value }).success).toBe(false);
  });
});

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
