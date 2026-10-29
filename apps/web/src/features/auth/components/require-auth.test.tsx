import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { useSessionStore } from "@/stores/session-store";
import { RequireAuth } from "./require-auth";

beforeEach(() => {
  useSessionStore.setState(useSessionStore.getInitialState());
});

function LoginProbe() {
  const location = useLocation();
  return <p>login from {(location.state as { from: string } | null)?.from}</p>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route element={<RequireAuth />}>
          <Route path="/portfolios" element={<p>private page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("waits with a status message while the session is being restored", () => {
    renderAt("/portfolios");

    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session…");
    expect(screen.queryByText("private page")).not.toBeInTheDocument();
    expect(screen.queryByText(/login from/)).not.toBeInTheDocument();
  });

  it("redirects to the login and remembers where the user was going", () => {
    useSessionStore.setState({ status: "anonymous" });

    renderAt("/portfolios?tab=open#top");

    expect(screen.getByText("login from /portfolios?tab=open#top")).toBeInTheDocument();
    expect(screen.queryByText("private page")).not.toBeInTheDocument();
  });

  it("renders the private page when the user is authenticated", () => {
    useSessionStore.setState({ status: "authenticated" });

    renderAt("/portfolios");

    expect(screen.getByText("private page")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("has no accessibility violations while it waits", async () => {
    const { container } = renderAt("/portfolios");

    expect(await axe(container)).toHaveNoViolations();
  });
});
