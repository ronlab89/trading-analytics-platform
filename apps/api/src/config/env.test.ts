import { describe, expect, it } from "vitest";
import { envSchema } from "./env.js";

const base = {
  JWT_SECRET: "x".repeat(32),
  DATABASE_URL: "postgresql://trading_runtime:secret@localhost:5432/trading_analytics_dev",
};

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

describe("envSchema LOG_LEVEL", () => {
  it.each([
    ["development", "debug"],
    ["test", "silent"],
    ["production", "info"],
  ])("defaults to the level of %s when LOG_LEVEL is absent", (nodeEnv, level) => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: nodeEnv });
    expect(result.success && result.data.LOG_LEVEL).toBe(level);
  });

  it("lets LOG_LEVEL override the default of the environment", () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: "test", LOG_LEVEL: "info" });
    expect(result.success && result.data.LOG_LEVEL).toBe("info");
  });

  it.each(["trace", "verbose", "INFO", ""])("rejects %s as a level", (value) => {
    expect(envSchema.safeParse({ ...base, LOG_LEVEL: value }).success).toBe(false);
  });
});

describe("envSchema SLOW_REQUEST_THRESHOLD_MS", () => {
  it("defaults to 500 milliseconds", () => {
    const result = envSchema.safeParse(base);
    expect(result.success && result.data.SLOW_REQUEST_THRESHOLD_MS).toBe(500);
  });

  it("reads the threshold from the environment", () => {
    const result = envSchema.safeParse({ ...base, SLOW_REQUEST_THRESHOLD_MS: "1200" });
    expect(result.success && result.data.SLOW_REQUEST_THRESHOLD_MS).toBe(1200);
  });

  it.each(["0", "-1", "1.5", "slow"])("rejects %s as a threshold", (value) => {
    expect(envSchema.safeParse({ ...base, SLOW_REQUEST_THRESHOLD_MS: value }).success).toBe(false);
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

describe("envSchema API_DOCS_ENABLED", () => {
  it.each([
    ["development", true],
    ["test", true],
    ["production", false],
  ])("defaults for %s to %s when it is not set", (nodeEnv, enabled) => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: nodeEnv });

    expect(result.success && result.data.API_DOCS_ENABLED).toBe(enabled);
  });

  it.each([
    ["production", "true", true],
    ["development", "false", false],
  ])("takes the value over the default (%s, %s)", (nodeEnv, value, enabled) => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: nodeEnv, API_DOCS_ENABLED: value });

    expect(result.success && result.data.API_DOCS_ENABLED).toBe(enabled);
  });

  it.each(["yes", "1", ""])("rejects %s", (value) => {
    expect(envSchema.safeParse({ ...base, API_DOCS_ENABLED: value }).success).toBe(false);
  });

  it("leaves the viewer CDN unset by default and accepts an http(s) URL", () => {
    const unset = envSchema.safeParse(base);
    const set = envSchema.safeParse({
      ...base,
      API_DOCS_CDN_URL: "https://cdn.example.com/scalar.js",
    });

    expect(unset.success && unset.data.API_DOCS_CDN_URL).toBeUndefined();
    expect(set.success && set.data.API_DOCS_CDN_URL).toBe("https://cdn.example.com/scalar.js");
    expect(envSchema.safeParse({ ...base, API_DOCS_CDN_URL: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });
});

describe("envSchema DATABASE_URL", () => {
  const { DATABASE_URL: _omitted, ...withoutUrl } = base;

  it("is required", () => {
    const result = envSchema.safeParse(withoutUrl);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((issue) => issue.path[0])).toContain(
      "DATABASE_URL",
    );
  });

  it.each(["postgresql://user:pw@db:5432/app", "postgres://user:pw@db:5432/app"])(
    "accepts %s",
    (value) => {
      const result = envSchema.safeParse({ ...base, DATABASE_URL: value });

      expect(result.success && result.data.DATABASE_URL).toBe(value);
    },
  );

  it.each(["mysql://user:pw@db:3306/app", "http://db:5432/app", "not a url", ""])(
    "rejects %j",
    (value) => {
      expect(envSchema.safeParse({ ...base, DATABASE_URL: value }).success).toBe(false);
    },
  );

  it("names the variable in the error and never echoes the value", () => {
    const result = envSchema.safeParse({
      ...base,
      DATABASE_URL: "mysql://user:hunter2@db:3306/app",
    });

    expect(result.success).toBe(false);
    const message = JSON.stringify(!result.success && result.error.issues);
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("hunter2");
  });
});

describe("envSchema JWT_SECRET", () => {
  const { JWT_SECRET: _omitted, ...withoutSecret } = base;

  it("is required", () => {
    const result = envSchema.safeParse(withoutSecret);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((issue) => issue.path[0])).toContain(
      "JWT_SECRET",
    );
  });

  it.each(["", "x".repeat(31)])("rejects the secret %j", (value) => {
    expect(envSchema.safeParse({ ...base, JWT_SECRET: value }).success).toBe(false);
  });

  it("accepts exactly 32 characters", () => {
    expect(envSchema.safeParse({ ...base, JWT_SECRET: "x".repeat(32) }).success).toBe(true);
  });

  it("names the variable in the error and never echoes the value", () => {
    const result = envSchema.safeParse({ ...base, JWT_SECRET: "short-secret-value" });

    expect(result.success).toBe(false);
    const message = JSON.stringify(!result.success && result.error.issues);
    expect(message).toContain("JWT_SECRET");
    expect(message).not.toContain("short-secret-value");
  });
});
