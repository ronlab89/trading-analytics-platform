import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { useLogout } from "./use-logout";

function cachedClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(["portfolios"], [{ id: "p-1" }]);
  return queryClient;
}

describe("useLogout", () => {
  it("ends the session through the session service", async () => {
    const logout = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const { result } = renderHook(() => useLogout(), {
      wrapper: sessionWrapper(fakeSessionService({ logout }), cachedClient()),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(logout).toHaveBeenCalledOnce();
  });

  it("drops every cached query so the next user never sees the previous one's data", async () => {
    const queryClient = cachedClient();
    const { result } = renderHook(() => useLogout(), {
      wrapper: sessionWrapper(fakeSessionService(), queryClient),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(["portfolios"])).toBeUndefined();
  });

  it("drops the cache even when the service fails", async () => {
    const queryClient = cachedClient();
    const logout = () => Promise.reject(new ApiError("NETWORK_ERROR", "down"));
    const { result } = renderHook(() => useLogout(), {
      wrapper: sessionWrapper(fakeSessionService({ logout }), queryClient),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(queryClient.getQueryData(["portfolios"])).toBeUndefined();
  });
});
