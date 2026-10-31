import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("is a plain text input that takes what the user types", async () => {
    render(<Input aria-label="Email" />);

    const input = screen.getByRole("textbox", { name: "Email" });
    await userEvent.type(input, "jane@example.com");

    expect(input).toHaveValue("jane@example.com");
  });

  it("passes the native attributes through", () => {
    render(<Input aria-label="Email" type="email" autoComplete="email" placeholder="you@x.com" />);

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).toHaveAttribute("placeholder", "you@x.com");
  });

  it("is disabled when asked to be", () => {
    render(<Input aria-label="Email" disabled />);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
  });

  it("draws the dark 2 px editing border when a pointer focuses it, as the Figma Editing state", () => {
    render(<Input aria-label="Email" />);

    const { className } = screen.getByRole("textbox", { name: "Email" });

    expect(className).toContain(
      "pointer:focus:not-aria-invalid:border-(--color-input-border-editing)",
    );
    expect(className).toContain(
      "pointer:focus:not-aria-invalid:shadow-[inset_0_0_0_1px_var(--color-input-border-editing)]",
    );
  });

  it("keeps the orange focus ring for keyboard navigation only", () => {
    render(<Input aria-label="Email" />);

    const { className } = screen.getByRole("textbox", { name: "Email" });

    expect(className).toContain("keyboard:focus-visible:outline-(--color-input-ring)");
    expect(className).toContain("keyboard:focus-visible:border-(--color-input-border-hover)");
    expect(className).not.toContain("pointer:focus-visible");
  });

  it("keeps the invalid state it is given outside a field", () => {
    render(<Input aria-label="Email" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeInvalid();
  });
});
