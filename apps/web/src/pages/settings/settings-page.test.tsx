import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { SettingsPage } from "./settings-page";

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

function renderPage(address = "/settings") {
  return render(
    <MemoryRouter initialEntries={[address]}>
      <SettingsPage />
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
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
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("lists the three sections in a menu, with Profile as the current one", () => {
    renderPage();

    const menu = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(menu.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Profile",
      "Preferences",
      "Demo mode",
    ]);
    expect(menu.getByRole("button", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("region", { name: "Profile" })).toBeInTheDocument();
  });

  it("shows one section at a time and keeps the choice in the address", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Preferences" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?section=preferences");
    expect(screen.getByRole("region", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("opens the section the address names", () => {
    renderPage("/settings?section=demo");
    expect(screen.getByRole("region", { name: "Demo mode" })).toBeInTheDocument();
  });

  it("falls back to Profile for a section that does not exist", () => {
    renderPage("/settings?section=billing");
    expect(screen.getByRole("region", { name: "Profile" })).toBeInTheDocument();
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

    await userEvent.click(within(tabs).getByRole("tab", { name: "Demo mode" }));

    expect(screen.getByTestId("search")).toHaveTextContent("?section=demo");
    expect(screen.getByRole("region", { name: "Demo mode" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
