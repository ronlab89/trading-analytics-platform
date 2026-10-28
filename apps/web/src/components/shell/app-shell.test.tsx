import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { AppShell } from "./app-shell";

function renderShell() {
  const router = createMemoryRouter([
    { element: <AppShell />, children: [{ path: "/", element: <h1>Content</h1> }] },
  ]);

  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
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
    useSessionStore.getState().signIn({
      user: { id: "u-1", email: "ana@example.com", displayName: "Ana Pérez", role: "TRADER" },
      session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
    });
    renderShell();

    // The activity bar and the mobile top bar each hold one; CSS shows one at a time.
    const menu = screen.getAllByRole("button", { name: "User menu" }).at(0);
    if (!menu) throw new Error("The shell has no user menu");
    await userEvent.click(menu);

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });
});
