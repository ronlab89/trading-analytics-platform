import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { useSessionStore } from "@/stores/session-store";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { useRealtimeConnection } from "./use-realtime-connection";

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

function setup() {
  const client = createFakeRealtimeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>
  );
  return { client, wrapper };
}

describe("useRealtimeConnection", () => {
  it.each(["unknown", "anonymous"] as const)(
    "does not connect while the session is %s",
    (status) => {
      useSessionStore.setState({ status });
      const { client, wrapper } = setup();

      renderHook(
        () => {
          useRealtimeConnection();
        },
        { wrapper },
      );

      expect(client.calls).toEqual({ connect: 0, disconnect: 0, retry: 0 });
    },
  );

  it("connects when the session is authenticated", () => {
    useSessionStore.setState({ status: "authenticated" });
    const { client, wrapper } = setup();

    renderHook(
      () => {
        useRealtimeConnection();
      },
      { wrapper },
    );

    expect(client.calls.connect).toBe(1);
    expect(client.calls.disconnect).toBe(0);
  });

  it("connects once the session becomes authenticated, and disconnects when it ends", () => {
    const { client, wrapper } = setup();
    renderHook(
      () => {
        useRealtimeConnection();
      },
      { wrapper },
    );

    act(() => {
      useSessionStore.setState({ status: "authenticated" });
    });
    expect(client.calls.connect).toBe(1);

    act(() => {
      useSessionStore.setState({ status: "anonymous" });
    });
    expect(client.calls.disconnect).toBe(1);
  });

  it("disconnects when the app unmounts", () => {
    useSessionStore.setState({ status: "authenticated" });
    const { client, wrapper } = setup();
    const { unmount } = renderHook(
      () => {
        useRealtimeConnection();
      },
      { wrapper },
    );

    unmount();

    expect(client.calls.disconnect).toBe(1);
  });

  it("does not reconnect when only the access token changes", () => {
    useSessionStore.setState({ status: "authenticated", accessToken: "old" });
    const { client, wrapper } = setup();
    renderHook(
      () => {
        useRealtimeConnection();
      },
      { wrapper },
    );

    act(() => {
      useSessionStore.setState({ accessToken: "new" });
    });

    expect(client.calls).toEqual({ connect: 1, disconnect: 0, retry: 0 });
  });
});
