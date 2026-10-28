import type { ApiOperation } from "@trading/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  BACKOFF_BASE_MS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  createHttpTradingClient,
} from "./http-trading-client";
import { ApiError } from "./trading-client";

const baseOperation = {
  tag: "Things",
  summary: "A thing",
  authenticated: true,
  errors: [],
} as const;

const getThing: ApiOperation = {
  ...baseOperation,
  operationId: "getThing",
  method: "get",
  path: "/api/v1/things/:thingId",
  success: { status: 200, description: "The thing.", schema: z.object({ data: z.string() }) },
};

const createThing: ApiOperation = {
  ...baseOperation,
  operationId: "createThing",
  method: "post",
  path: "/api/v1/things",
  body: z.object({ name: z.string() }),
  success: { status: 201, description: "Created.", schema: z.object({ data: z.string() }) },
};

const ok = (data: string, status = 200) => Response.json({ data }, { status });
const failure = (status: number, code = "INTERNAL_ERROR") =>
  Response.json({ error: { code, message: "boom", requestId: "req-1" } }, { status });

function setup(responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchMock = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    if (next === undefined) {
      throw new Error("Unexpected extra request");
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  const client = createHttpTradingClient({
    baseUrl: "http://api.test/",
    fetch: fetchMock,
    sleep,
    getAccessToken: () => "token-1",
  });
  return { client, fetchMock, sleep };
}

const networkError = () => new TypeError("Failed to fetch");
const input = { params: { thingId: "t 1" } };

afterEach(() => {
  vi.useRealTimers();
});

describe("HTTP TradingClient: requests", () => {
  it("builds the URL from the path parameters and the query, and sends the bearer token", async () => {
    const { client, fetchMock } = setup([ok("a")]);

    const result = await client.call(getThing, { ...input, query: { page: 2, skip: undefined } });

    expect(result).toEqual({ data: "a" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/api/v1/things/t%201?page=2");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer token-1" });
  });

  it("sends the JSON body and the Idempotency-Key of a creation", async () => {
    const { client, fetchMock } = setup([ok("a", 201)]);

    await client.call(createThing, { body: { name: "x" }, idempotencyKey: "key-1" });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"name":"x"}');
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": "key-1",
    });
  });
});

describe("HTTP TradingClient: session cookie", () => {
  const refresh: ApiOperation = {
    ...baseOperation,
    operationId: "refresh",
    method: "post",
    path: "/api/v1/auth/refresh",
    authenticated: false,
    cookies: z.object({ refresh_token: z.string() }),
    success: { status: 200, description: "Refreshed.", schema: z.object({ data: z.string() }) },
  };
  const login: ApiOperation = {
    ...baseOperation,
    operationId: "login",
    method: "post",
    path: "/api/v1/auth/login",
    authenticated: false,
    body: z.object({ email: z.string() }),
    success: {
      status: 200,
      description: "Logged in.",
      headers: { "Set-Cookie": "The refresh token." },
      schema: z.object({ data: z.string() }),
    },
  };

  it("sends the cookie and the CSRF header on an operation that reads the refresh cookie", async () => {
    const { client, fetchMock } = setup([ok("a")]);

    await client.call(refresh);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.credentials).toBe("include");
    expect(init?.headers).toMatchObject({ "X-Requested-With": "XMLHttpRequest" });
  });

  it("lets the browser store the cookie an operation sets, without the CSRF header", async () => {
    const { client, fetchMock } = setup([ok("a")]);

    await client.call(login, { body: { email: "a@b.co" } });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.credentials).toBe("include");
    expect(init?.headers).not.toHaveProperty("X-Requested-With");
  });

  it("keeps the default credentials and no CSRF header on every other operation", async () => {
    const { client, fetchMock } = setup([ok("a")]);

    await client.call(getThing, input);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).not.toHaveProperty("credentials");
    expect(init?.headers).not.toHaveProperty("X-Requested-With");
  });
});

describe("HTTP TradingClient: timeout", () => {
  it(`fails with TIMEOUT after ${String(REQUEST_TIMEOUT_MS)} ms`, async () => {
    vi.useFakeTimers();
    const hangingFetch = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = createHttpTradingClient({
      baseUrl: "http://api.test",
      fetch: hangingFetch,
      sleep: () => Promise.resolve(),
    });

    const outcome = client.call(createThing, { body: {} }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(hangingFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await outcome).toMatchObject({ code: "TIMEOUT" });
  });
});

describe("HTTP TradingClient: retries on reads", () => {
  it("retries a GET after a network error", async () => {
    const { client, fetchMock } = setup([networkError(), ok("a")]);

    await expect(client.call(getThing, input)).resolves.toEqual({ data: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([502, 503, 504])("retries a GET after a %i", async (status) => {
    const { client, fetchMock } = setup([failure(status), ok("a")]);

    await expect(client.call(getThing, input)).resolves.toEqual({ data: "a" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it(`gives up after ${String(MAX_RETRIES)} retries and raises the last failure`, async () => {
    const { client, fetchMock } = setup([failure(503), failure(503), failure(503)]);

    await expect(client.call(getThing, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it("raises NETWORK_ERROR when every attempt fails to connect", async () => {
    const { client, fetchMock } = setup([networkError(), networkError(), networkError()]);

    await expect(client.call(getThing, input)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it("waits with exponential backoff between retries", async () => {
    const { client, sleep } = setup([failure(503), failure(503), ok("a")]);

    await client.call(getThing, input);

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([BACKOFF_BASE_MS, BACKOFF_BASE_MS * 2]);
  });
});

describe("HTTP TradingClient: never retried", () => {
  it.each([400, 401, 403, 404, 409, 429])(
    "does not retry a GET answered with %i",
    async (status) => {
      const code = status === 429 ? "RATE_LIMITED" : "VALIDATION_ERROR";
      const { client, fetchMock } = setup([failure(status, code)]);

      await expect(client.call(getThing, input)).rejects.toMatchObject({ code, status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("does not retry a write without an Idempotency-Key after a network error", async () => {
    const { client, fetchMock } = setup([networkError()]);

    await expect(client.call(createThing, { body: {} })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a write without an Idempotency-Key after a 503", async () => {
    const { client, fetchMock } = setup([failure(503)]);

    await expect(client.call(createThing, { body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("HTTP TradingClient: idempotent creations", () => {
  it("retries a creation that carries an Idempotency-Key with the same key", async () => {
    const { client, fetchMock } = setup([failure(503), ok("a", 201)]);

    await expect(
      client.call(createThing, { body: { name: "x" }, idempotencyKey: "key-1" }),
    ).resolves.toEqual({ data: "a" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init?.headers as Record<string, string>)["Idempotency-Key"],
    );
    expect(keys).toEqual(["key-1", "key-1"]);
  });

  it("does not retry an idempotent creation answered with a 4xx", async () => {
    const { client, fetchMock } = setup([failure(409, "CONFLICT")]);

    await expect(
      client.call(createThing, { body: {}, idempotencyKey: "key-1" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("HTTP TradingClient: responses", () => {
  it("maps the error envelope to an ApiError", async () => {
    const envelope = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid",
        requestId: "req-9",
        details: [{ field: "name", code: "too_small", message: "Too short" }],
      },
    };
    const { client } = setup([Response.json(envelope, { status: 400 })]);

    const error = await client.call(createThing, { body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      requestId: "req-9",
      details: envelope.error.details,
    });
  });

  it("raises INVALID_RESPONSE when a success does not match its contract", async () => {
    const { client } = setup([Response.json({ data: 42 })]);

    await expect(client.call(getThing, input)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("raises INVALID_RESPONSE when an error is not the API envelope", async () => {
    const { client } = setup([new Response("<html>Bad gateway</html>", { status: 500 })]);

    await expect(client.call(getThing, input)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 500,
    });
  });

  it("returns undefined for a success without a body schema", async () => {
    const deleteThing: ApiOperation = {
      ...baseOperation,
      operationId: "deleteThing",
      method: "delete",
      path: "/api/v1/things/:thingId",
      success: { status: 204, description: "Deleted." },
    };
    const { client } = setup([new Response(null, { status: 204 })]);

    await expect(client.call(deleteThing, input)).resolves.toBeUndefined();
  });
});
