import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Field } from "./field";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("is a multi-line text box that takes what the user types", async () => {
    render(<Textarea aria-label="Description" />);

    const textarea = screen.getByRole("textbox", { name: "Description" });
    await userEvent.type(textarea, "Long term{Enter}growth");

    expect(textarea).toHaveValue("Long term\ngrowth");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("passes the native attributes through", () => {
    render(<Textarea aria-label="Description" maxLength={200} placeholder="Notes" rows={3} />);

    const textarea = screen.getByRole("textbox", { name: "Description" });

    expect(textarea).toHaveAttribute("maxlength", "200");
    expect(textarea).toHaveAttribute("placeholder", "Notes");
    expect(textarea).toHaveAttribute("rows", "3");
  });

  it("is disabled when asked to be", () => {
    render(<Textarea aria-label="Description" disabled />);

    expect(screen.getByRole("textbox", { name: "Description" })).toBeDisabled();
  });

  it("keeps the invalid state it is given outside a field", () => {
    render(<Textarea aria-label="Description" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Description" })).toBeInvalid();
  });

  it("lets the user resize it vertically, as the Figma grip shows", () => {
    render(<Textarea aria-label="Description" />);

    expect(screen.getByRole("textbox", { name: "Description" })).toHaveClass("resize-y");
  });

  it("takes its label, description and error state from the field around it", () => {
    render(
      <Field description="Optional notes" error="Too long" label="Description">
        <Textarea />
      </Field>,
    );

    const textarea = screen.getByRole("textbox", { name: "Description" });

    expect(textarea).toBeInvalid();
    expect(textarea).toHaveAccessibleDescription("Too long");
  });

  it("has no accessibility violations inside a field", async () => {
    const { container } = render(
      <Field label="Description" required>
        <Textarea />
      </Field>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
