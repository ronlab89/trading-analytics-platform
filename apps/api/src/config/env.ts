import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long."),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(900),
});

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
