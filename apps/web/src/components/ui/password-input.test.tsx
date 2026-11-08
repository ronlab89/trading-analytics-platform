import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Field } from "./field";
import { PasswordInput } from "./password-input";

const labels = { showLabel: "Show password", hideLabel: "Hide password" };

describe("PasswordInput", () => {
  it("hides what the user types until they ask to see it", async () => {
    render(<PasswordInput aria-label="Password" {...labels} />);
    const input = screen.getByLabelText("Password");

    await userEvent.type(input, "secret");

    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("secret");
  });

  it("shows and hides the password with a button that says what it will do", async () => {
    render(<PasswordInput aria-label="Password" {...labels} />);
    const input = screen.getByLabelText("Password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));

    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("does not submit the form when the toggle is pressed", async () => {
    const onSubmit = vi.fn((event: React.SubmitEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" {...labels} />
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("points the toggle at the input it controls", () => {
    render(<PasswordInput id="pw" aria-label="Password" {...labels} />);

    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-controls",
      "pw",
    );
  });

  it("disables the toggle together with the input", () => {
    render(<PasswordInput aria-label="Password" disabled {...labels} />);

    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });

  it("takes its label, error and disabled state from the field", () => {
    render(
      <Field label="Password" error="Enter your password" disabled>
        <PasswordInput {...labels} />
      </Field>,
    );
    const input = screen.getByLabelText("Password");

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Enter your password");
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Show password" })).toBeDisabled();
  });

  it("points the toggle at the field's control", () => {
    render(
      <Field label="Password">
        <PasswordInput {...labels} />
      </Field>,
    );

    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-controls",
      screen.getByLabelText("Password").id,
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Field label="Password" error="Enter your password">
        <PasswordInput {...labels} />
      </Field>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
