// Tests for scripts/smoke.mjs. Run with: pnpm test:scripts

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { URL } from "node:url";

import { buildSteps, main, runSteps } from "./smoke.mjs";

/** Collects what the script writes. */
function sink() {
  const lines = [];
  return { lines, write: (text) => lines.push(text), text: () => lines.join("") };
}

describe("runSteps", () => {
  it("runs the steps in order and exits 0 when all pass", async () => {
    const out = sink();
    const order = [];
    const code = await runSteps(
      [
        { name: "first", run: async () => order.push("first") },
        { name: "second", run: async () => order.push("second") },
      ],
      out.write,
    );

    assert.equal(code, 0);
    assert.deepEqual(order, ["first", "second"]);
    assert.deepEqual(out.lines, ["ok   first\n", "ok   second\n", "smoke passed (2 steps)\n"]);
  });

  it("stops at the first failing step, names it and exits 1", async () => {
    const out = sink();
    const order = [];
    const code = await runSteps(
      [
        { name: "first", run: async () => order.push("first") },
        {
          name: "second",
          run: async () => {
            throw new Error("boom");
          },
        },
        { name: "third", run: async () => order.push("third") },
      ],
      out.write,
    );

    assert.equal(code, 1);
    assert.deepEqual(order, ["first"]);
    assert.deepEqual(out.lines, [
      "ok   first\n",
      "FAIL second: boom\n",
      "smoke failed at: second\n",
    ]);
  });
});

const json = (status, body) => new globalThis.Response(JSON.stringify(body), { status });
const UNAUTHORIZED = () =>
  json(401, { error: { code: "UNAUTHORIZED", message: "Authentication required." } });
const TOKEN = "secret-access-token";

/**
 * A fetch double for the four calls of the smoke test. `overrides` replaces the answer of a call
 * ("METHOD /path"); `portfolios` answers the two GET /api/v1/portfolios calls in order.
 */
function stackFetch({
  overrides = {},
  portfolios = [UNAUTHORIZED, () => json(200, { data: [{ id: "p1" }] })],
} = {}) {
  const calls = [];
  let portfolioCalls = 0;
  const answers = {
    "GET /health/ready": () => json(200, { status: "ready" }),
    "POST /api/v1/auth/login": () => json(200, { data: { session: { accessToken: TOKEN } } }),
    ...overrides,
  };
  const fetch = async (url, init = {}) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    calls.push({ key, headers: init.headers ?? {}, body: init.body });
    if (key === "GET /api/v1/portfolios") {
      const answer = portfolios[Math.min(portfolioCalls, portfolios.length - 1)];
      portfolioCalls += 1;
      return answer();
    }
    const answer = answers[key];
    if (answer === undefined) throw new Error(`unexpected request ${key}`);
    return answer();
  };
  return { fetch, calls };
}

async function runStack(stack) {
  const out = sink();
  const code = await runSteps(
    buildSteps({
      baseUrl: "http://api.test",
      email: "demo@example.test",
      password: "demo-password",
      fetch: stack.fetch,
      readyTimeoutMs: 30,
      readyIntervalMs: 5,
    }),
    out.write,
  );
  return { code, output: out.text() };
}

describe("smoke steps", () => {
  it("passes when the API refuses the anonymous call and serves the seeded rows", async () => {
    const stack = stackFetch();
    const { code, output } = await runStack(stack);

    assert.equal(code, 0);
    assert.match(output, /smoke passed \(4 steps\)/);
    const [anonymous, authenticated] = stack.calls.filter(
      (call) => call.key === "GET /api/v1/portfolios",
    );
    assert.equal(anonymous.headers.Authorization, undefined);
    assert.equal(authenticated.headers.Authorization, `Bearer ${TOKEN}`);
  });

  it("never prints the token or the password", async () => {
    const { output } = await runStack(stackFetch());

    assert.doesNotMatch(output, new RegExp(TOKEN));
    assert.doesNotMatch(output, /demo-password/);
  });

  it("fails at readiness when the API never answers 200", async () => {
    const { code, output } = await runStack(
      stackFetch({ overrides: { "GET /health/ready": () => json(503, {}) } }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL readiness: .*503/);
    assert.match(output, /smoke failed at: readiness/);
  });

  it("fails at readiness with the reason when the connection is refused", async () => {
    const { code, output } = await runStack(
      stackFetch({
        overrides: {
          "GET /health/ready": () => {
            throw new Error("fetch failed");
          },
        },
      }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL readiness: .*fetch failed/);
  });

  it("fails when an anonymous request is not refused with the error envelope", async () => {
    const { code, output } = await runStack(
      stackFetch({ portfolios: [() => json(200, { data: [] })] }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL unauthenticated request: expected 401, got 200/);
  });

  it("points at the seed when the login is refused", async () => {
    const { code, output } = await runStack(
      stackFetch({ overrides: { "POST /api/v1/auth/login": UNAUTHORIZED } }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL login: .*401.*db:seed/);
    assert.match(output, /smoke failed at: login/);
  });

  it("fails when the table-reading route returns no rows", async () => {
    const { code, output } = await runStack(
      stackFetch({ portfolios: [UNAUTHORIZED, () => json(200, { data: [] })] }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL read a table: .*no portfolios.*db:seed/);
  });

  it("fails when the table-reading route answers 500 (migrations not applied)", async () => {
    const { code, output } = await runStack(
      stackFetch({
        portfolios: [UNAUTHORIZED, () => json(500, { error: { code: "INTERNAL_ERROR" } })],
      }),
    );

    assert.equal(code, 1);
    assert.match(output, /FAIL read a table: expected 200, got 500/);
  });
});

describe("main", () => {
  it("exits 1 and names the readiness step when nothing listens", async () => {
    const out = sink();
    const code = await main({
      env: { SMOKE_API_URL: "http://127.0.0.1:1", SMOKE_READY_TIMEOUT_MS: "50" },
      write: out.write,
    });

    assert.equal(code, 1);
    assert.match(out.text(), /smoke failed at: readiness/);
  });
});
