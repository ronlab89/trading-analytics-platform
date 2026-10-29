import type { ApiOperation } from "@trading/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type TradingClient } from "@/api/trading-client";
import { createSessionService } from "./session-service";
import { useSessionStore } from "@/stores/session-store";

const user = { id: "u-1", email: "jane@example.com", displayName: "Jane Doe", role: "TRADER" };
const session = (accessToken: string) => ({
  data: { user, session: { accessToken, expiresAt: "2026-10-27T12:15:00.000Z" } },
});

function setup(...results: unknown[]) {
  const queue = [...results];
  const call = vi.fn<(operation: ApiOperation, input?: unknown) => Promise<unknown>>(() => {
    const next = queue.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const client: TradingClient = { call };
  return { service: createSessionService(client), call };
}

const unauthorized = () => new ApiError("UNAUTHORIZED", "No session", 401);

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

describe("session: login", () => {
  it("keeps the user and the access token in memory", async () => {
    const { service, call } = setup(session("token-1"));

    await service.login("jane@example.com", "secret");

    expect(call.mock.calls[0]?.[0].operationId).toBe("login");
    expect(call.mock.calls[0]?.[1]).toEqual({
      body: { email: "jane@example.com", password: "secret" },
    });
    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      user,
      accessToken: "token-1",
      expired: false,
    });
  });

  it("stays signed out and rethrows when the API refuses", async () => {
    const { service } = setup(new ApiError("UNAUTHORIZED", "Bad credentials", 401));
    useSessionStore.setState({ status: "anonymous" });

    await expect(service.login("jane@example.com", "wrong")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    expect(useSessionStore.getState().status).toBe("anonymous");
    expect(useSessionStore.getState().accessToken).toBeUndefined();
  });
});

describe("session: restore on load", () => {
  it("signs in again from the refresh cookie", async () => {
    const { service, call } = setup(session("token-2"));

    await service.restore();

    expect(call.mock.calls[0]?.[0].operationId).toBe("refreshSession");
    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      accessToken: "token-2",
    });
  });

  it("ends up signed out, not expired, when there is no cookie", async () => {
    const { service } = setup(unauthorized());

    await service.restore();

    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", expired: false });
  });

  it("ends up signed out when the API cannot be reached", async () => {
    const { service } = setup(new ApiError("NETWORK_ERROR", "down"));

    await service.restore();

    expect(useSessionStore.getState().status).toBe("anonymous");
  });
});

describe("session: refresh", () => {
  it("sends one request when several callers refresh at once", async () => {
    const { service, call } = setup(session("token-3"));

    const results = await Promise.all([service.refresh(), service.refresh(), service.refresh()]);

    expect(call).toHaveBeenCalledOnce();
    expect(results).toEqual([true, true, true]);
    expect(useSessionStore.getState().accessToken).toBe("token-3");
  });

  it("can refresh again once the previous refresh has settled", async () => {
    const { service, call } = setup(session("token-3"), session("token-4"));

    await service.refresh();
    await service.refresh();

    expect(call).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().accessToken).toBe("token-4");
  });

  it("expires the session when the API no longer accepts the cookie", async () => {
    const { service } = setup(session("token-1"), unauthorized());
    await service.login("jane@example.com", "secret");

    const refreshed = await service.refresh();

    expect(refreshed).toBe(false);
    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", expired: true });
    expect(useSessionStore.getState().accessToken).toBeUndefined();
    expect(useSessionStore.getState().user).toBeUndefined();
  });

  it("keeps the session when the refresh fails for another reason", async () => {
    const { service } = setup(session("token-1"), new ApiError("NETWORK_ERROR", "down"));
    await service.login("jane@example.com", "secret");

    await expect(service.refresh()).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      accessToken: "token-1",
    });
  });
});

describe("session: logout", () => {
  it("revokes the session and forgets the user", async () => {
    const { service, call } = setup(session("token-1"), undefined);
    await service.login("jane@example.com", "secret");

    await service.logout();

    expect(call.mock.calls[1]?.[0].operationId).toBe("logout");
    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", expired: false });
    expect(useSessionStore.getState().accessToken).toBeUndefined();
  });

  it("rejects and keeps the session when the revocation request fails", async () => {
    const { service } = setup(session("token-1"), new ApiError("NETWORK_ERROR", "down"));
    await service.login("jane@example.com", "secret");

    await expect(service.logout()).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      user,
      accessToken: "token-1",
    });
  });

  it("does not let a refresh that was in flight sign the user back in", async () => {
    let answerRefresh: (value: unknown) => void = () => undefined;
    const pendingRefresh = new Promise((resolve) => {
      answerRefresh = resolve;
    });
    const { service } = setup(session("token-1"), pendingRefresh, undefined);
    await service.login("jane@example.com", "secret");

    const refreshing = service.refresh();
    await service.logout();
    answerRefresh(session("token-2"));

    await expect(refreshing).resolves.toBe(false);
    expect(useSessionStore.getState().status).toBe("anonymous");
    expect(useSessionStore.getState().accessToken).toBeUndefined();
  });

  it("starts a fresh refresh after logout instead of joining the discarded one", async () => {
    let answerRefresh: (value: unknown) => void = () => undefined;
    const pendingRefresh = new Promise((resolve) => {
      answerRefresh = resolve;
    });
    const { service, call } = setup(
      session("token-1"),
      pendingRefresh,
      undefined,
      session("token-3"),
    );
    await service.login("jane@example.com", "secret");
    void service.refresh();
    await service.logout();

    await expect(service.refresh()).resolves.toBe(true);
    answerRefresh(session("token-2"));

    expect(call).toHaveBeenCalledTimes(4);
    expect(useSessionStore.getState().accessToken).toBe("token-3");
  });
});
