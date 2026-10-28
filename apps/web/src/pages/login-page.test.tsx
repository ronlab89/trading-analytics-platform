import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, type To } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import { LoginPage } from "./login-page";

beforeEach(() => {
  useSessionStore.setState({ ...useSessionStore.getInitialState(), status: "anonymous" });
});

function setup(state?: unknown) {
  const entry: To & { state?: unknown } = { pathname: "/login", state };
  const Wrapper = sessionWrapper(fakeSessionService());
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>start page</p>} />
          <Route path="/portfolios" element={<p>portfolios page</p>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
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

  it("waits with a status message, and no form, while the session is being restored", () => {
    useSessionStore.setState({ status: "unknown" });

    setup();

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session…");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("sends a signed-in user to the page they were going to", () => {
    useSessionStore.setState({ status: "authenticated" });

    setup({ from: "/portfolios" });

    expect(screen.getByText("portfolios page")).toBeInTheDocument();
  });

  it("sends a signed-in user to the start when there is no destination", () => {
    useSessionStore.setState({ status: "authenticated" });

    setup();

    expect(screen.getByText("start page")).toBeInTheDocument();
  });

  it("does not follow a destination outside the app", () => {
    useSessionStore.setState({ status: "authenticated" });

    setup({ from: "//evil.example" });

    expect(screen.getByText("start page")).toBeInTheDocument();
  });

  it("tells the user the session expired, above the fields", () => {
    useSessionStore.setState({ expired: true });

    setup();

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Your session expired");
    expect(notice).toHaveTextContent("For your security, sign in again to continue.");
    expect(
      notice.compareDocumentPosition(screen.getByLabelText("Email")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no expiry notice on a normal visit", () => {
    setup();

    expect(screen.queryByText("Your session expired")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    useSessionStore.setState({ expired: true });
    const { container } = setup();

    expect(await axe(container)).toHaveNoViolations();
  });
});
