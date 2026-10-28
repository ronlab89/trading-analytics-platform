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

  it("keeps the invalid state it is given outside a field", () => {
    render(<Input aria-label="Email" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Email" })).toBeInvalid();
  });
});
