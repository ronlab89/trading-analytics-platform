import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { ConnectedStatusBar } from "./connected-status-bar";

function renderBar(state: Parameters<typeof createFakeRealtimeClient>[0]) {
  const client = createFakeRealtimeClient(state);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RealtimeClientProvider client={client}>
        <ConnectedStatusBar alertCount={1} calculationTime="14:32:07" />
      </RealtimeClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("ConnectedStatusBar", () => {
  it("shows the live connection, and follows it when it is lost and when it fails", () => {
    const client = renderBar("connected");
    const bar = screen.getByRole("contentinfo");
    expect(bar).toHaveTextContent("Live");

    act(() => {
      client.setState("reconnecting");
    });
    expect(bar).toHaveTextContent("Reconnecting");

    act(() => {
      client.setState("failed");
    });
    expect(bar).toHaveTextContent("Offline");
    expect(bar).toHaveTextContent("Calculation stopped");
  });
});
