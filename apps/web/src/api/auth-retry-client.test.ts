import type { ApiOperation } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import { createAuthRetryClient } from "./auth-retry-client";
import { ApiError, type TradingClient } from "./trading-client";

const protectedOperation = { operationId: "listPortfolios", authenticated: true } as ApiOperation;
const publicOperation = { operationId: "login", authenticated: false } as ApiOperation;

const unauthorized = () => new ApiError("UNAUTHORIZED", "Token expired", 401);

function setup(refreshResult: boolean | Error, ...results: unknown[]) {
  const queue = [...results];
  const call = vi.fn<TradingClient["call"]>(() => {
    const next = queue.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const refresh = vi.fn(() =>
    refreshResult instanceof Error ? Promise.reject(refreshResult) : Promise.resolve(refreshResult),
  );
  return { client: createAuthRetryClient({ call }, refresh), call, refresh };
}

describe("auth retry client", () => {
  it("returns the result untouched when the call succeeds", async () => {
    const { client, call, refresh } = setup(true, { data: "ok" });

    await expect(client.call(protectedOperation, { query: { page: 1 } })).resolves.toEqual({
      data: "ok",
    });

    expect(call).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the session and retries once with the same input after a 401", async () => {
    const input = { query: { page: 1 } };
    const { client, call, refresh } = setup(true, unauthorized(), { data: "ok" });

    await expect(client.call(protectedOperation, input)).resolves.toEqual({ data: "ok" });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1]).toEqual([protectedOperation, input]);
  });

  it("rethrows the original 401 when the refresh is refused", async () => {
    const original = unauthorized();
    const { client, call } = setup(false, original);

    await expect(client.call(protectedOperation)).rejects.toBe(original);

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not retry twice when the retried call is also a 401", async () => {
    const second = unauthorized();
    const { client, call, refresh } = setup(true, unauthorized(), second);

    await expect(client.call(protectedOperation)).rejects.toBe(second);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("rethrows the refresh failure when the refresh itself breaks", async () => {
    const outage = new ApiError("NETWORK_ERROR", "The network request failed");
    const { client, call } = setup(outage, unauthorized());

    await expect(client.call(protectedOperation)).rejects.toBe(outage);

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("never refreshes for an operation that is not authenticated", async () => {
    const bad = new ApiError("UNAUTHORIZED", "Bad credentials", 401);
    const { client, refresh } = setup(true, bad);

    await expect(client.call(publicOperation)).rejects.toBe(bad);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not refresh for errors other than a 401", async () => {
    const forbidden = new ApiError("FORBIDDEN", "Not allowed", 403);
    const { client, refresh } = setup(true, forbidden);

    await expect(client.call(protectedOperation)).rejects.toBe(forbidden);

    expect(refresh).not.toHaveBeenCalled();
  });
});
