import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { TradingClient } from "@/api/trading-client";
import { SettingsPage } from "./settings-page";

const build = vi.hoisted<{ mode: "real" | "demo" }>(() => ({ mode: "real" }));

vi.mock("@/config/env", () => ({
  env: {
    get VITE_APP_MODE() {
      return build.mode;
    },
  },
}));

const originalMatchMedia = Reflect.get(window, "matchMedia");

/** A narrow screen: the tablet and the phone, where the sections are tabs. */
function narrowScreen() {
  Reflect.set(window, "matchMedia", (query: string) => ({
    matches: query === "(max-width: 900px)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

/** The Preferences card asks for the preferences and the portfolios; the rest needs no API. */
const client = {
  call: vi.fn((operation: { operationId: string }) =>
    Promise.resolve({ data: operation.operationId === "listPortfolios" ? [] : null }),
  ),
} as unknown as TradingClient;

function renderPage(address = "/settings") {
  const Wrapper = tradingClientWrapper(client);
  const router = createMemoryRouter(
    [
      {
        path: "/settings",
        element: (
          <>
            <SettingsPage />
            <Link to="/portfolios">Go to portfolios</Link>
            <Where />
          </>
        ),
      },
      { path: "/portfolios", element: <p>The portfolios</p> },
    ],
    { initialEntries: [address] },
  );
  return render(
    <Wrapper>
      <RouterProvider router={router} />
    </Wrapper>,
  );
}

beforeEach(() => {
  build.mode = "real";
  useSessionStore.setState(useSessionStore.getInitialState());
  useSessionStore.getState().signIn({
    user: { id: "u1", email: "jane@example.com", displayName: "Jane Doe", role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
});

afterEach(() => {
  Reflect.set(window, "matchMedia", originalMatchMedia);
});

describe("SettingsPage", () => {
  it("names the page and says who is signed in", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Manage your account and your preferences.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Jane Doe" })).toBeInTheDocument();
  });

  it("lists Profile and Preferences in a menu, with Profile as the current one", () => {
    renderPage();

    const menu = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(menu.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Profile",
      "Preferences",
    ]);
    expect(menu.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the name, the email and the role of the account, to read and not to edit", () => {
    renderPage();

    const profile = within(screen.getByRole("region", { name: "Profile" }));
    expect(profile.getByText("Jane Doe")).toBeInTheDocument();
    expect(profile.getByText("jane@example.com")).toBeInTheDocument();
    expect(profile.getByText("Trader")).toBeInTheDocument();
    expect(profile.queryByRole("textbox")).not.toBeInTheDocument();
    expect(profile.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows one section at a time and keeps the choice in the address", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Preferences" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?section=preferences");
    expect(screen.getByRole("region", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("falls back to Profile for a section that does not exist", () => {
    renderPage("/settings?section=billing");
    expect(screen.getByRole("region", { name: "Profile" })).toBeInTheDocument();
  });

  it("has no Demo mode in a real build, not even when the address asks for it", () => {
    renderPage("/settings?section=demo");

    expect(screen.queryByRole("button", { name: "Demo mode" })).not.toBeInTheDocument();
    expect(screen.queryByText("Demo account")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Profile" })).toBeInTheDocument();
  });

  describe("in the demo build", () => {
    beforeEach(() => {
      build.mode = "demo";
    });

    it("says it is a demo account next to the name, and has the Demo mode section", async () => {
      renderPage();

      expect(screen.getByText("Demo account")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Demo mode" }));

      const demo = within(screen.getByRole("region", { name: "Demo mode" }));
      expect(demo.getByText("Fictional data")).toBeInTheDocument();
      expect(
        demo.getByText("You are using demo data, with no connection to a real server."),
      ).toBeInTheDocument();
      expect(demo.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  it("turns the menu into tabs on the tablet and the phone", async () => {
    narrowScreen();
    renderPage();

    expect(screen.queryByRole("navigation", { name: "Settings sections" })).not.toBeInTheDocument();
    const tabs = screen.getByRole("tablist", { name: "Settings sections" });
    expect(within(tabs).getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(within(tabs).getByRole("tab", { name: "Preferences" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?section=preferences");
    expect(screen.getByRole("region", { name: "Preferences" })).toBeInTheDocument();
  });

  describe("leaving with changes that are not saved", () => {
    async function editPreferences() {
      await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
      await userEvent.click(await screen.findByRole("checkbox", { name: /Reduce motion/ }));
    }
    const dialog = () => screen.findByRole("dialog", { name: "Leave without saving?" });

    it("asks before changing section, and keeps the change when the user keeps editing", async () => {
      renderPage();
      await editPreferences();

      await userEvent.click(screen.getByRole("button", { name: "Profile" }));
      const asking = within(await dialog());
      expect(asking.getByText(/unsaved changes in your preferences/)).toBeInTheDocument();
      await userEvent.click(asking.getByRole("button", { name: "Keep editing" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeChecked();
    });

    it("changes section and loses the change when the user leaves", async () => {
      renderPage();
      await editPreferences();

      await userEvent.click(screen.getByRole("button", { name: "Profile" }));
      await userEvent.click(
        within(await dialog()).getByRole("button", { name: "Leave without saving" }),
      );

      expect(await screen.findByRole("region", { name: "Profile" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
      expect(await screen.findByRole("checkbox", { name: /Reduce motion/ })).not.toBeChecked();
    });

    it("does not ask when there is nothing to lose", async () => {
      renderPage();
      await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
      await screen.findByRole("checkbox", { name: /Reduce motion/ });

      await userEvent.click(screen.getByRole("button", { name: "Profile" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Profile" })).toBeInTheDocument();
    });

    it("asks before leaving Settings too, and goes on when the user leaves", async () => {
      renderPage();
      await editPreferences();

      await userEvent.click(screen.getByRole("link", { name: "Go to portfolios" }));
      expect(screen.queryByText("The portfolios")).not.toBeInTheDocument();
      await userEvent.click(
        within(await dialog()).getByRole("button", { name: "Leave without saving" }),
      );

      expect(await screen.findByText("The portfolios")).toBeInTheDocument();
    });

    it("stays in Settings when the user keeps editing after trying to leave it", async () => {
      renderPage();
      await editPreferences();

      await userEvent.click(screen.getByRole("link", { name: "Go to portfolios" }));
      await userEvent.click(within(await dialog()).getByRole("button", { name: "Keep editing" }));

      expect(screen.queryByText("The portfolios")).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Reduce motion/ })).toBeChecked();
    });

    it("lets the browser warn on reload or close only while there are changes", async () => {
      renderPage();
      await userEvent.click(screen.getByRole("button", { name: "Preferences" }));
      await screen.findByRole("checkbox", { name: /Reduce motion/ });

      const clean = new Event("beforeunload", { cancelable: true });
      fireEvent(window, clean);
      expect(clean.defaultPrevented).toBe(false);

      await userEvent.click(screen.getByRole("checkbox", { name: /Reduce motion/ }));
      await waitFor(() => {
        const dirty = new Event("beforeunload", { cancelable: true });
        fireEvent(window, dirty);
        expect(dirty.defaultPrevented).toBe(true);
      });
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
