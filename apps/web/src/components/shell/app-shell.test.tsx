import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type TradingClient } from "@/api/trading-client";
import { Toaster } from "@/components/ui/sonner";
import { createQueryClient } from "@/lib/query-client";
import type { SessionService } from "@/services/session/session-service";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AppShell } from "./app-shell";

function portfolio(id: string, name: string, status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return {
    id,
    userId: "u-1",
    name,
    description: null,
    baseCurrency: "USD",
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function clientListing(portfolios: unknown[]): TradingClient {
  return { call: () => Promise.resolve({ data: portfolios }) };
}

function renderShell(
  service: SessionService = fakeSessionService(),
  client: TradingClient = clientListing([portfolio("p1", "Crecimiento")]),
) {
  const router = createMemoryRouter([
    { element: <AppShell />, children: [{ path: "/", element: <h1>Content</h1> }] },
  ]);
  const queryClient = createQueryClient();
  const SessionWrapper = sessionWrapper(service, queryClient);
  const ClientWrapper = tradingClientWrapper(client, queryClient);

  return render(
    <SessionWrapper>
      <ClientWrapper>
        <RouterProvider router={router} />
        <Toaster />
      </ClientWrapper>
    </SessionWrapper>,
  );
}

function signInAsAna() {
  useSessionStore.getState().signIn({
    user: { id: "u-1", email: "ana@example.com", displayName: "Ana Pérez", role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
}

// The activity bar and the mobile top bar each hold one; CSS shows one at a time.
async function openUserMenu() {
  const menu = screen.getAllByRole("button", { name: "User menu" }).at(0);
  if (!menu) throw new Error("The shell has no user menu");
  await userEvent.click(menu);
}

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
  useActivePortfolioStore.setState(useActivePortfolioStore.getInitialState());
});

describe("AppShell", () => {
  it("renders the routed view inside the main landmark", () => {
    renderShell();

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Content" }),
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = renderShell();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("names the signed-in user in the user menu", async () => {
    signInAsAna();
    renderShell();

    await openUserMenu();

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("shows the first active portfolio of the user in the selector, never an archived one", async () => {
    renderShell(
      fakeSessionService(),
      clientListing([
        portfolio("p0", "Experimental", "ARCHIVED"),
        portfolio("p1", "Renta fija"),
        portfolio("p2", "Crecimiento"),
      ]),
    );

    const selector = await screen.findByRole("button", { name: "Select portfolio" });
    expect(selector).toHaveTextContent("Renta fija");

    await userEvent.click(selector);
    expect(screen.getByRole("menuitemradio", { name: "Crecimiento" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Experimental" })).not.toBeInTheDocument();
  });

  it("switches the active portfolio when the user picks another one", async () => {
    renderShell(
      fakeSessionService(),
      clientListing([portfolio("p1", "Renta fija"), portfolio("p2", "Crecimiento")]),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Select portfolio" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Crecimiento" }));

    expect(screen.getByRole("button", { name: "Select portfolio" })).toHaveTextContent(
      "Crecimiento",
    );
  });

  it("lets the user retry when the portfolios fail to load", async () => {
    const call = vi
      .fn<TradingClient["call"]>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "down"))
      .mockResolvedValue({ data: [portfolio("p1", "Crecimiento")] });
    renderShell(fakeSessionService(), { call });

    await userEvent.click(
      await screen.findByRole("button", { name: "Couldn't load portfolios. Retry" }),
    );

    expect(await screen.findByRole("button", { name: "Select portfolio" })).toHaveTextContent(
      "Crecimiento",
    );
  });

  it("signs out through the session service from the user menu", async () => {
    signInAsAna();
    const logout = vi.fn<() => Promise<void>>(() => Promise.resolve());
    renderShell(fakeSessionService({ logout }));

    await openUserMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledOnce();
    });
  });

  it("tells the user when signing out fails, and keeps them signed in", async () => {
    signInAsAna();
    const logout = () => Promise.reject(new ApiError("NETWORK_ERROR", "down"));
    renderShell(fakeSessionService({ logout }));

    await openUserMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("Could not sign out")).toBeVisible();
    expect(screen.getByText(/You are still signed in/)).toBeVisible();
    expect(useSessionStore.getState().status).toBe("authenticated");
  });
});
