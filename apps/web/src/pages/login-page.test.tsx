import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { LoginPage } from "./login-page";

function setup() {
  return render(<LoginPage />, { wrapper: sessionWrapper(fakeSessionService()) });
}

describe("LoginPage", () => {
  it("has one heading, in the main area, with its introduction", () => {
    setup();

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Sign in with your account to see your portfolio.")).toBeVisible();
  });

  it("shows the login form", () => {
    setup();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the brand with its message", () => {
    setup();

    expect(screen.getByText("Trading Analytics")).toBeInTheDocument();
    expect(screen.getByText("Your portfolio, clear and up to date.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Follow the performance, the risk and the distribution of your investments in one place.",
      ),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = setup();

    expect(await axe(container)).toHaveNoViolations();
  });
});
