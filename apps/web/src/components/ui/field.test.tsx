import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("names the control with its label", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("describes the control with the help text", () => {
    render(
      <Field label="Email" description="We never share it">
        <Input />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(
      "We never share it",
    );
  });

  it("marks the control invalid and describes it with the error instead of the help text", () => {
    render(
      <Field label="Email" description="We never share it" error="Enter a valid email">
        <Input />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.queryByText("We never share it")).not.toBeInTheDocument();
  });

  it("is valid and has no description when there is neither help nor error", () => {
    render(
      <Field label="Email">
        <Input />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input).toBeValid();
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("marks the control required and shows the marker without reading it aloud", () => {
    render(
      <Field label="Email" required>
        <Input />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).toBeRequired();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("disables the control", () => {
    render(
      <Field label="Email" disabled>
        <Input />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
  });

  it("keeps the label pointing at the control even when the control brings its own id", () => {
    render(
      <Field label="Email">
        <Input id="own-id" />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("id", "own-id");
  });

  it("keeps a description the control brings next to the field's own", () => {
    render(
      <Field label="Email" description="Help">
        <Input aria-describedby="extra" />
      </Field>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });

    expect(input.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
    expect(input.getAttribute("aria-describedby")).toContain("extra");
  });

  it("gives each field its own ids", () => {
    render(
      <>
        <Field label="Email">
          <Input />
        </Field>
        <Field label="Name">
          <Input />
        </Field>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Email" }).id).not.toBe(
      screen.getByRole("textbox", { name: "Name" }).id,
    );
  });

  it("has no accessibility violations with an error", async () => {
    const { container } = render(
      <Field label="Email" error="Enter a valid email" required>
        <Input />
      </Field>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
