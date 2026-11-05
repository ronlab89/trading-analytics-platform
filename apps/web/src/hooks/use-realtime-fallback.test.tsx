import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { POLLING_INTERVAL_MS, useRealtimeFallback } from "./use-realtime-fallback";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const client = createFakeRealtimeClient("connected");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const fetchData = vi.fn(() => Promise.resolve("data"));
  /** A screen reading data: the query is active while this hook is mounted. */
  const render = () =>
    renderHook(
      () => {
        useQuery({ queryKey: ["visible"], queryFn: fetchData, staleTime: Infinity });
        useRealtimeFallback();
      },
      { wrapper },
    );
  return { client, fetchData, render };
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useRealtimeFallback", () => {
  it("does not read anything again while the connection is up", async () => {
    const { fetchData, render } = setup();
    render();
    await tick(0);
    expect(fetchData).toHaveBeenCalledTimes(1);

    await tick(POLLING_INTERVAL_MS * 3);

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it.each(["reconnecting", "failed"] as const)(
    "reads the visible data every 10 seconds while the state is %s",
    async (state) => {
      const { client, fetchData, render } = setup();
      render();
      await tick(0);

      act(() => {
        client.setState(state);
      });
      await tick(POLLING_INTERVAL_MS - 1);
      expect(fetchData).toHaveBeenCalledTimes(1);
      await tick(1);
      expect(fetchData).toHaveBeenCalledTimes(2);
      await tick(POLLING_INTERVAL_MS);
      expect(fetchData).toHaveBeenCalledTimes(3);
    },
  );

  it("stops as soon as the connection is back", async () => {
    const { client, fetchData, render } = setup();
    render();
    await tick(0);
    act(() => {
      client.setState("reconnecting");
    });
    await tick(POLLING_INTERVAL_MS);
    expect(fetchData).toHaveBeenCalledTimes(2);

    act(() => {
      client.setState("connected");
    });
    await tick(POLLING_INTERVAL_MS * 3);

    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it.each(["disconnected", "connecting"] as const)(
    "does not poll while the state is %s",
    async (state) => {
      const { client, fetchData, render } = setup();
      render();
      await tick(0);

      act(() => {
        client.setState(state);
      });
      await tick(POLLING_INTERVAL_MS * 3);

      expect(fetchData).toHaveBeenCalledTimes(1);
    },
  );

  it("stops when the screen unmounts", async () => {
    const { client, fetchData, render } = setup();
    const { unmount } = render();
    await tick(0);
    act(() => {
      client.setState("failed");
    });

    unmount();
    await tick(POLLING_INTERVAL_MS * 3);

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it("does not read data that no screen is showing", async () => {
    const { client, fetchData, render } = setup();
    const { unmount } = render();
    await tick(0);
    act(() => {
      client.setState("reconnecting");
    });
    // The hook goes with the screen, so look at it from a second mount that reads nothing.
    unmount();
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
      </QueryClientProvider>
    );
    queryClient.setQueryData(["hidden"], "old");
    renderHook(
      () => {
        useRealtimeFallback();
      },
      { wrapper },
    );

    await tick(POLLING_INTERVAL_MS * 2);

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["hidden"])).toBe("old");
  });
});
