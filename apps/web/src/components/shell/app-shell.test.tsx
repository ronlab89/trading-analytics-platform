import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { AppShell } from "./app-shell";

function renderShell() {
  const router = createMemoryRouter([
    { element: <AppShell />, children: [{ path: "/", element: <h1>Content</h1> }] },
  ]);

  return render(<RouterProvider router={router} />);
}

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
});
