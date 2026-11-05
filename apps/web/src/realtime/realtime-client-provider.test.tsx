import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import {
  RealtimeClientProvider,
  useConnectionState,
  useRealtimeClient,
} from "./realtime-client-provider";

function wrapperFor(client: ReturnType<typeof createFakeRealtimeClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RealtimeClientProvider client={client}>{children}</RealtimeClientProvider>;
  };
}

describe("useRealtimeClient", () => {
  it("hands the client the app was given, so a test can swap it", () => {
    const client = createFakeRealtimeClient();
    const { result } = renderHook(() => useRealtimeClient(), { wrapper: wrapperFor(client) });

    expect(result.current).toBe(client);
  });

  it("refuses to work outside the provider, naming it", () => {
    function Probe() {
      useRealtimeClient();
      return null;
    }
    // React logs the error it throws; the test only cares about the message.
    const log = console.error;
    console.error = () => undefined;
    try {
      expect(() => render(<Probe />)).toThrow(
        "useRealtimeClient must be used inside a RealtimeClientProvider",
      );
    } finally {
      console.error = log;
    }
  });
});

describe("useConnectionState", () => {
  it("reads the state of the client and follows it", () => {
    const client = createFakeRealtimeClient("connecting");
    const { result } = renderHook(() => useConnectionState(), { wrapper: wrapperFor(client) });
    expect(result.current).toBe("connecting");

    act(() => {
      client.setState("connected");
    });
    expect(result.current).toBe("connected");

    act(() => {
      client.setState("reconnecting");
    });
    expect(result.current).toBe("reconnecting");
  });

  it("stops listening when the component goes away", () => {
    const client = createFakeRealtimeClient();
    function Probe() {
      return <p>{useConnectionState()}</p>;
    }
    const { unmount } = render(<Probe />, { wrapper: wrapperFor(client) });
    expect(screen.getByText("disconnected")).toBeInTheDocument();
    expect(client.stateListenerCount()).toBe(1);

    unmount();

    expect(client.stateListenerCount()).toBe(0);
  });
});
