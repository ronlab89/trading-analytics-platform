import { z } from "zod";

/**
 * The demo never reads the API addresses (ADR-012 point 9): its bundle carries placeholders, not the
 * development address of the API, so a demo build cannot point at a server by accident.
 */
const DEFAULT_API_BASE_URL = __DEMO_BUILD__ ? "https://unused.invalid" : "http://localhost:7001";
const DEFAULT_WS_URL = __DEMO_BUILD__ ? "wss://unused.invalid/ws" : "ws://localhost:7001/ws";

const envSchema = z.object({
  VITE_APP_MODE: z.enum(["real", "demo"]).default("real"),
  VITE_API_BASE_URL: z.url().default(DEFAULT_API_BASE_URL),
  /** The server WebSocket: same port as the API, on the fixed path `/ws` (docs/14 §14, ADR-007). */
  VITE_WS_URL: z.url({ protocol: /^wss?$/ }).default(DEFAULT_WS_URL),
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
