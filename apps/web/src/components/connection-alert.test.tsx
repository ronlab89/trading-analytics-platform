import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { i18n } from "@/i18n";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient } from "@/test/fake-realtime-client";
import { ConnectionAlert } from "./connection-alert";

function setup(state: Parameters<typeof createFakeRealtimeClient>[0], dataAt?: number) {
  const client = createFakeRealtimeClient(state);
  const queryClient = new QueryClient();
  if (dataAt !== undefined) queryClient.setQueryData(["data"], "x", { updatedAt: dataAt });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeClientProvider client={client}>
        <ConnectionAlert />
      </RealtimeClientProvider>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

const LAST_DATA = new Date(2026, 10, 5, 14, 31, 55).getTime();

describe("ConnectionAlert", () => {
  it.each(["connected", "connecting", "disconnected"] as const)(
    "says nothing while %s",
    (state) => {
      const { container } = setup(state);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("warns that prices are paused while reconnecting, with the time of the last price", () => {
    setup("reconnecting", LAST_DATA);

    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("Offline: prices are paused");
    expect(alert).toHaveTextContent("We show the last price received (14:31:55).");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not invent a time when no price has arrived", () => {
    setup("reconnecting");

    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("We show the last price received. They will update");
    expect(alert).not.toHaveTextContent("(");
  });

  it("is an error with a retry once the client gave up, and the retry asks the client", async () => {
    const { client } = setup("failed", LAST_DATA);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We could not restore the connection");
    expect(alert).toHaveTextContent("(14:31:55)");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(client.calls.retry).toBe(1);
  });

  it("appears and goes away with the connection", () => {
    const { client, container } = setup("connected");
    expect(container).toBeEmptyDOMElement();

    act(() => {
      client.setState("reconnecting");
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      client.setState("connected");
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("speaks Spanish when the language is Spanish", async () => {
    await i18n.changeLanguage("es");
    try {
      setup("reconnecting", LAST_DATA);

      expect(screen.getByRole("status")).toHaveTextContent(
        "Sin conexión: los precios están en pausa",
      );
      expect(screen.getByRole("status")).toHaveTextContent("(14:31:55)");
    } finally {
      await i18n.changeLanguage("en");
    }
  });

  it.each(["reconnecting", "failed"] as const)(
    "has no accessibility violations while %s",
    async (state) => {
      const { container } = setup(state, LAST_DATA);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
