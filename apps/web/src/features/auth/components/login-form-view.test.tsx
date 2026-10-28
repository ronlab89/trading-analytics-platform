import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { LoginFormView, type LoginFormViewProps } from "./login-form-view";

function setup(overrides: Partial<LoginFormViewProps> = {}) {
  const props: LoginFormViewProps = {
    values: { email: "", password: "" },
    errors: {},
    status: "idle",
    offline: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const view = render(<LoginFormView {...props} />);
  return { ...view, props };
}

describe("LoginFormView", () => {
  it("shows the two fields, the sign in button and the demo entry", () => {
    setup();

    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Enter the demo" })).toBeEnabled();
    expect(screen.getByText("No credentials · uses fictional data")).toBeInTheDocument();
  });

  it("hints what each field expects", () => {
    setup();

    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "name@example.com");
    expect(screen.getByLabelText("Password")).toHaveAttribute("placeholder", "Your password");
  });

  it("asks the browser for the right autofill", () => {
    setup();

    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("shows what the user typed and reports every change with its field", async () => {
    const { props } = setup({ values: { email: "jane@example.com", password: "" } });

    expect(screen.getByLabelText("Email")).toHaveValue("jane@example.com");

    await userEvent.type(screen.getByLabelText("Password"), "a");

    expect(props.onChange).toHaveBeenCalledWith("password", "a");
  });

  it("submits from the button and from the keyboard", async () => {
    const { props } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.type(screen.getByLabelText("Email"), "{Enter}");

    expect(props.onSubmit).toHaveBeenCalledTimes(2);
  });

  it("describes each invalid field with its message", () => {
    setup({ errors: { email: "Enter a valid email", password: "Enter your password" } });

    expect(screen.getByLabelText("Email")).toBeInvalid();
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.getByLabelText("Password")).toBeInvalid();
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password");
  });

  it("locks the fields and the demo while signing in, and shows the button as busy", () => {
    setup({ status: "submitting" });

    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Signing in…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Enter the demo" })).toBeDisabled();
  });

  it("locks the fields and the sign in while entering the demo, and shows the demo as busy", () => {
    setup({ status: "entering-demo" });

    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Entering…" })).toHaveAttribute("aria-busy", "true");
  });

  it("calls the demo handler and does not submit the form", async () => {
    const onEnterDemo = vi.fn();
    const { props } = setup({ onEnterDemo });

    await userEvent.click(screen.getByRole("button", { name: "Enter the demo" }));

    expect(onEnterDemo).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the demo entry visible and inert until it is connected", async () => {
    const { props } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Enter the demo" }));

    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("shows an alert between the fields and the button", () => {
    setup({
      alert: {
        tone: "error",
        title: "Wrong email or password",
        description: "Check your details.",
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Wrong email or password");
    expect(screen.getByRole("alert")).toHaveTextContent("Check your details.");
  });

  it("offers to try again from the alert", async () => {
    const onRetry = vi.fn();
    setup({
      alert: { tone: "error", title: "Service unavailable", description: "Later.", onRetry },
    });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no retry action when the alert does not offer one", () => {
    setup({ alert: { tone: "error", title: "Wrong email or password", description: "Check." } });

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("disables both actions while offline", () => {
    setup({ offline: true });

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter the demo" })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeEnabled();
  });

  it("has no accessibility violations with an alert and errors", async () => {
    const { container } = setup({
      errors: { email: "Enter a valid email" },
      alert: {
        tone: "warning",
        title: "No connection",
        description: "Check it.",
        onRetry: vi.fn(),
      },
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});
