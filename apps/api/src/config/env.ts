import { z } from "zod";

const ORIGIN_PATTERN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;

// ADR-009 point 7: the level follows the environment unless LOG_LEVEL says otherwise.
const DEFAULT_LOG_LEVEL = {
  development: "debug",
  test: "silent",
  production: "info",
} as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().int().positive().default(500),
    PORT: z.coerce.number().int().positive().default(7001),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long."),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(900),
    SESSION_IDLE_SECONDS: z.coerce.number().int().positive().default(604800),
    SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(2592000),
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:5173")
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .refine((origins) => origins.every((origin) => ORIGIN_PATTERN.test(origin)), {
        message:
          "CORS_ORIGIN must be a comma-separated list of http(s)://host[:port] origins; wildcards are not allowed.",
      }),
    // ADR-002 point 7: serve the OpenAPI document and the Scalar viewer. Unset
    // means on outside production and off in production.
    API_DOCS_ENABLED: z.enum(["true", "false"]).optional(),
    // Where the viewer loads its script from; unset uses Scalar's CDN.
    API_DOCS_CDN_URL: z.url({ protocol: /^https?$/ }).optional(),
  })
  .transform((values) => ({
    ...values,
    LOG_LEVEL: values.LOG_LEVEL ?? DEFAULT_LOG_LEVEL[values.NODE_ENV],
    API_DOCS_ENABLED:
      values.API_DOCS_ENABLED === undefined
        ? values.NODE_ENV !== "production"
        : values.API_DOCS_ENABLED === "true",
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * Validates required environment configuration at process startup and
 * fails fast on invalid/missing values, per 14-deployment-spec.md §12.
 * Never logs the actual secret values, only which keys are invalid.
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("[api] invalid environment configuration:");
    console.error(parsed.error.flatten((issue) => issue.message).fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
