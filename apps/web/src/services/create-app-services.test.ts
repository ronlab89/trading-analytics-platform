import type { ApiOperation } from "@trading/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type TradingClient } from "@/api/trading-client";
import { useSessionStore } from "@/stores/session-store";
import { createAppServices } from "./create-app-services";

const user = {
  id: "u-1",
  email: "jane@example.com",
  displayName: "Jane Doe",
  role: "TRADER" as const,
};
const session = (accessToken: string) => ({
  data: { user, session: { accessToken, expiresAt: "2026-10-27T12:15:00.000Z" } },
});
const protectedOperation = { operationId: "listPortfolios", authenticated: true } as ApiOperation;

/** A base client that answers by operation id, so the test reads like the API's behavior. */
function setup(answers: Record<string, unknown[]>) {
  const call = vi.fn<TradingClient["call"]>((operation) => {
    const next = answers[operation.operationId]?.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { services: createAppServices({ call }), call };
}

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

describe("app services", () => {
  it("renews the session through the base client when an authenticated call meets a 401", async () => {
    const { services, call } = setup({
      listPortfolios: [new ApiError("UNAUTHORIZED", "Token expired", 401), { data: [] }],
      refreshSession: [session("token-2")],
    });

    await expect(services.client.call(protectedOperation)).resolves.toEqual({ data: [] });

    expect(call.mock.calls.map(([operation]) => operation.operationId)).toEqual([
      "listPortfolios",
      "refreshSession",
      "listPortfolios",
    ]);
    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      accessToken: "token-2",
    });
  });

  it("signs the user out when the refresh is refused, leaving the original 401 to the caller", async () => {
    const original = new ApiError("UNAUTHORIZED", "Token expired", 401);
    const { services } = setup({
      listPortfolios: [original],
      refreshSession: [new ApiError("UNAUTHORIZED", "No session", 401)],
    });
    useSessionStore.getState().signIn(session("token-1").data);

    await expect(services.client.call(protectedOperation)).rejects.toBe(original);

    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", expired: true });
  });

  it("does not wrap the session's own calls, so a refused refresh cannot loop", async () => {
    const { services, call } = setup({
      refreshSession: [new ApiError("UNAUTHORIZED", "No session", 401)],
    });

    await expect(services.session.refresh()).resolves.toBe(false);

    expect(call).toHaveBeenCalledTimes(1);
  });
});
