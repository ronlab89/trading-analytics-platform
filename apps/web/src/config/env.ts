import { z } from "zod";

const envSchema = z.object({
  VITE_APP_MODE: z.enum(["real", "demo"]).default("real"),
  VITE_API_BASE_URL: z.url().default("http://localhost:7001"),
});

export type Env = z.infer<typeof envSchema>;

/** Validates the build-time variables; the error names the keys, never their values. */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid web environment: ${keys.join(", ")}`);
  }
  return result.data;
}

export const env = parseEnv(import.meta.env);
