import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { ProfilePage } from "./profile-page";

const build = vi.hoisted<{ mode: "real" | "demo" }>(() => ({ mode: "real" }));

vi.mock("@/config/env", () => ({
  env: {
    get VITE_APP_MODE() {
      return build.mode;
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  build.mode = "real";
  useSessionStore.setState(useSessionStore.getInitialState());
  useSessionStore.getState().signIn({
    user: { id: "u1", email: "jane@example.com", displayName: "Jane Doe", role: "ADMIN" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
});

describe("ProfilePage", () => {
  it("summarises the account to read: who, the email and the role", () => {
    renderPage();

    const card = within(screen.getByRole("region", { name: "Profile" }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(card.getByText("Jane Doe")).toBeInTheDocument();
    expect(card.getByText("jane@example.com")).toBeInTheDocument();
    expect(card.getByText("Admin")).toBeInTheDocument();
    expect(card.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("leads to Settings to change anything", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("says it is a demo account only in the demo build", () => {
    renderPage();
    expect(screen.queryByText("Demo account")).not.toBeInTheDocument();

    build.mode = "demo";
    renderPage();
    expect(screen.getByText("Demo account")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
