import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { useConnectionStatus } from "./use-connection-status";

const NOW = new Date(2026, 10, 5, 14, 32, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(state: Parameters<typeof createFakeRealtimeClient>[0] = "connected") {
  const client = createFakeRealtimeClient(state);
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
    </QueryClientProvider>
  );
  const result = renderHook(() => useConnectionStatus("14:32:07"), { wrapper });
  const receiveData = (secondsAgo: number) => {
    act(() => {
      queryClient.setQueryData(["data", secondsAgo], "x", {
        updatedAt: NOW.getTime() - secondsAgo * 1000,
      });
    });
  };
  return { client, queryClient, receiveData, ...result };
}

describe("useConnectionStatus", () => {
  it("says it is waiting until some data has arrived", () => {
    const { result } = setup();

    expect(result.current.connection).toBe("live");
    expect(result.current.lastSync).toEqual({ kind: "waiting" });
  });

  it("counts the seconds since the newest data while the connection is live", () => {
    const { result, receiveData } = setup();
    receiveData(10);
    receiveData(3);
    receiveData(20);

    expect(result.current.lastSync).toEqual({ kind: "syncedAgo", seconds: 3 });

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.lastSync).toEqual({ kind: "syncedAgo", seconds: 5 });
  });

  it("writes the time of the last data and stops counting once the connection is lost", () => {
    const { result, client, receiveData } = setup();
    receiveData(5);

    act(() => {
      client.setState("reconnecting");
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.connection).toBe("reconnecting");
    expect(result.current.lastSync).toEqual({ kind: "lastDataAt", time: "14:31:55" });
  });

  it("follows the state down to offline, with the calculation stopped", () => {
    const { result, client } = setup();

    act(() => {
      client.setState("failed");
    });

    expect(result.current.connection).toBe("offline");
    expect(result.current.calculation).toEqual({ kind: "stopped" });
  });

  it("starts the count again from the data that comes back with the connection", () => {
    const { result, client, receiveData } = setup("reconnecting");
    receiveData(60);
    expect(result.current.lastSync).toEqual({ kind: "lastDataAt", time: "14:31:00" });

    act(() => {
      client.setState("connected");
    });
    receiveData(1);

    expect(result.current.lastSync).toEqual({ kind: "syncedAgo", seconds: 1 });
  });

  it("stops its clock when it unmounts", () => {
    const { unmount } = setup();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
