import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import type { TradingClient } from "@/api/trading-client";
import { createQueryClient } from "@/lib/query-client";
import { useSessionStore } from "@/stores/session-store";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { routes } from "./router";

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

// The shell lists the portfolios; these tests are about routing, so that call never answers.
const silentClient = { call: () => new Promise(() => undefined) } as TradingClient;

function renderAt(path: string) {
  const queryClient = createQueryClient();
  const SessionWrapper = sessionWrapper(fakeSessionService(), queryClient);
  const ClientWrapper = tradingClientWrapper(silentClient, queryClient);
  return render(
    <SessionWrapper>
      <ClientWrapper>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </ClientWrapper>
    </SessionWrapper>,
  );
}

describe("routes", () => {
  it("sends an anonymous visitor of a private page to the login", () => {
    useSessionStore.setState({ status: "anonymous" });

    renderAt("/");

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("sends an anonymous visitor of an unknown address to the login too", () => {
    useSessionStore.setState({ status: "anonymous" });

    renderAt("/does-not-exist");

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the login on its own, without the shell", () => {
    useSessionStore.setState({ status: "anonymous" });

    renderAt("/login");

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("waits for the session to be restored before choosing a page", () => {
    renderAt("/");

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session…");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("shows the home page, inside the shell, to a signed-in user", () => {
    useSessionStore.setState({ status: "authenticated" });

    renderAt("/");

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Trading Analytics Platform" }),
    );
  });

  it("keeps the not-found page inside the shell for a signed-in user", () => {
    useSessionStore.setState({ status: "authenticated" });

    renderAt("/does-not-exist");

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    );
  });

  it("does not show the login to a signed-in user", () => {
    useSessionStore.setState({ status: "authenticated" });

    renderAt("/login");

    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Trading Analytics Platform" }),
    ).toBeInTheDocument();
  });
});
