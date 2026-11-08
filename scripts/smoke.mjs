// Smoke test of the local full stack (docs/14-deployment-spec.md §49, ADR-006 point 11).
//
// Run it after the stack is up and the seed has run:
//   docker compose --profile full up -d --build
//   pnpm --filter @trading/database db:seed
//   pnpm smoke
//
// It does not start, stop or seed anything. Steps, in order:
//   1. readiness: GET /health/ready answers 200 (waits for the API to come up)
//   2. unauthenticated request: GET /api/v1/portfolios answers 401 with the error envelope
//   3. login: POST /api/v1/auth/login with the seeded user returns an access token
//   4. read a table: GET /api/v1/portfolios with the token returns the seeded portfolios
//      (readiness only proves SELECT 1, so this is what proves the migrations were applied)
//
// Output: one line per step, then a summary. It never prints the password or the token.
// Exit code: 1 at the first failing step, 0 otherwise.
//
// Environment (all optional): SMOKE_API_URL (default http://127.0.0.1:$API_PORT, port 7001),
// SMOKE_EMAIL and SMOKE_PASSWORD (default: the public demo user of the seed),
// SMOKE_READY_TIMEOUT_MS (default 60000).

import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const SEED_COMMAND = "pnpm --filter @trading/database db:seed";
const REQUEST_TIMEOUT_MS = 5000;

/** The demo user of packages/database/src/seed/data (a public value, not a secret). */
const DEFAULT_EMAIL = "demo@trading-analytics.dev";
const DEFAULT_PASSWORD = "demo1234";

/**
 * Runs the steps in order and stops at the first failure.
 *
 * @param {{ name: string, run: () => Promise<unknown> }[]} steps
 * @param {(text: string) => void} write
 * @returns {Promise<number>} the exit code
 */
export async function runSteps(steps, write) {
  for (const step of steps) {
    try {
      await step.run();
      write(`ok   ${step.name}\n`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      write(`FAIL ${step.name}: ${reason}\n`);
      write(`smoke failed at: ${step.name}\n`);
      return 1;
    }
  }
  write(`smoke passed (${String(steps.length)} steps)\n`);
  return 0;
}

/** Why a request failed, including the system error behind "fetch failed". */
function describeFailure(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause : undefined;
  const code = cause && "code" in cause ? ` (${String(cause.code)})` : "";
  return `${error.message}${code}`;
}

/**
 * @param {{
 *   baseUrl: string,
 *   email: string,
 *   password: string,
 *   fetch: typeof fetch,
 *   readyTimeoutMs: number,
 *   readyIntervalMs: number,
 * }} options
 */
export function buildSteps({ baseUrl, email, password, fetch, readyTimeoutMs, readyIntervalMs }) {
  const request = (path, init = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  const expectStatus = (response, expected) => {
    if (response.status !== expected) {
      throw new Error(`expected ${String(expected)}, got ${String(response.status)}`);
    }
  };

  /** Set by the login step and used by the last one. */
  let accessToken = "";

  return [
    {
      name: "readiness",
      run: async () => {
        const deadline = Date.now() + readyTimeoutMs;
        let last;
        for (;;) {
          try {
            const response = await request("/health/ready");
            if (response.status === 200) return;
            last = `status ${String(response.status)}`;
          } catch (error) {
            last = describeFailure(error);
          }
          if (Date.now() >= deadline) break;
          await sleep(readyIntervalMs);
        }
        throw new Error(
          `GET /health/ready did not answer 200 within ${String(readyTimeoutMs)} ms (last: ${last})`,
        );
      },
    },
    {
      name: "unauthenticated request",
      run: async () => {
        const response = await request("/api/v1/portfolios");
        expectStatus(response, 401);
        const body = await response.json();
        if (body?.error?.code !== "UNAUTHORIZED") {
          throw new Error("the 401 answer does not carry the standard error envelope");
        }
      },
    },
    {
      name: "login",
      run: async () => {
        const response = await request("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (response.status === 401) {
          throw new Error(`expected 200, got 401 (is the database seeded? run: ${SEED_COMMAND})`);
        }
        expectStatus(response, 200);
        const body = await response.json();
        const token = body?.data?.session?.accessToken;
        if (typeof token !== "string" || token === "") {
          throw new Error("the login answer has no access token");
        }
        accessToken = token;
      },
    },
    {
      name: "read a table",
      run: async () => {
        const response = await request("/api/v1/portfolios", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        expectStatus(response, 200);
        const body = await response.json();
        if (!Array.isArray(body?.data) || body.data.length === 0) {
          throw new Error(`no portfolios returned; run: ${SEED_COMMAND}`);
        }
      },
    },
  ];
}

/**
 * @param {{ env?: Record<string, string | undefined>, write?: (text: string) => void }} [options]
 * @returns {Promise<number>} the exit code
 */
export async function main({
  env = process.env,
  write = (text) => process.stdout.write(text),
} = {}) {
  const steps = buildSteps({
    baseUrl: env.SMOKE_API_URL ?? `http://127.0.0.1:${env.API_PORT ?? "7001"}`,
    email: env.SMOKE_EMAIL ?? DEFAULT_EMAIL,
    password: env.SMOKE_PASSWORD ?? DEFAULT_PASSWORD,
    fetch: globalThis.fetch,
    readyTimeoutMs: Number(env.SMOKE_READY_TIMEOUT_MS ?? "60000"),
    readyIntervalMs: 1000,
  });
  return runSteps(steps, write);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
