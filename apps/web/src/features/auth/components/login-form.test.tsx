import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/trading-client";
import "@/i18n";
import { fakeSessionService, sessionWrapper } from "@/test/session-wrapper";
import type { SessionService } from "@/services/session/session-service";
import { LoginForm } from "./login-form";

function setup(login: SessionService["login"] = () => Promise.resolve()) {
  const service = fakeSessionService({ login });
  render(<LoginForm />, { wrapper: sessionWrapper(service) });
  return { login };
}

async function fillAndSubmit(email = "jane@example.com", password = "secret") {
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signs in with what the user typed", async () => {
    const login = vi.fn<SessionService["login"]>(() => Promise.resolve());
    setup(login);

    await fillAndSubmit();

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("jane@example.com", "secret");
    });
  });

  it("explains every invalid field and does not call the API", async () => {
    const login = vi.fn<SessionService["login"]>(() => Promise.resolve());
    setup(login);

    await fillAndSubmit("not-an-email", "");

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password");
    expect(login).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    setup();
    await fillAndSubmit("not-an-email", "secret");

    await userEvent.type(screen.getByLabelText("Email"), "x");

    expect(screen.getByLabelText("Email")).not.toHaveAccessibleDescription("Enter a valid email");
  });

  it("shows the busy state while the request is in flight", async () => {
    setup(() => new Promise(() => undefined));

    await fillAndSubmit();

    expect(await screen.findByRole("button", { name: "Signing in…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("tells a wrong password apart, with no retry", async () => {
    setup(() => Promise.reject(new ApiError("UNAUTHORIZED", "Nope", 401)));

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("tells a rate limit apart, with no retry", async () => {
    setup(() => Promise.reject(new ApiError("RATE_LIMITED", "Slow", 429)));

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers to try again when the service is unavailable, and tries again", async () => {
    const login = vi
      .fn<SessionService["login"]>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "Down"))
      .mockResolvedValueOnce(undefined);
    setup(login);

    await fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(2);
    });
    expect(login).toHaveBeenLastCalledWith("jane@example.com", "secret");
  });

  it("warns when offline and does not let the user submit", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const login = vi.fn<SessionService["login"]>(() => Promise.resolve());
    setup(login);

    expect(screen.getByRole("status")).toHaveTextContent("No connection");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(login).not.toHaveBeenCalled();
  });

  it("only checks the connection again when retrying while offline, and never sends", async () => {
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const login = vi.fn<SessionService["login"]>(() => Promise.resolve());
    setup(login);
    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status")).toHaveTextContent("No connection");

    onLine.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.queryByText("No connection")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(login).not.toHaveBeenCalled();
  });
});
