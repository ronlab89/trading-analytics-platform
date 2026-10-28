import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Checkbox, CheckboxItem } from "./checkbox";

describe("Checkbox", () => {
  it("is unchecked until the user checks it, with the mouse or the space bar", async () => {
    render(<Checkbox aria-label="Remember me" />);
    const checkbox = screen.getByRole("checkbox", { name: "Remember me" });

    expect(checkbox).not.toBeChecked();

    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("reports every change", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Remember me" onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("can be controlled", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Remember me" checked={false} onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("announces the indeterminate state as mixed", () => {
    render(<Checkbox aria-label="Select all" checked="indeterminate" />);

    expect(screen.getByRole("checkbox")).toBePartiallyChecked();
  });

  it("ignores the user when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Remember me" disabled onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("keeps the invalid state it is given", () => {
    render(<Checkbox aria-label="Accept the terms" aria-invalid />);

    expect(screen.getByRole("checkbox")).toBeInvalid();
  });

  it("goes into the form data when checked", async () => {
    let data: FormData | undefined;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          data = new FormData(event.currentTarget);
        }}
      >
        <Checkbox aria-label="Remember me" name="remember" />
        <button type="submit">Send</button>
      </form>,
    );

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(data?.get("remember")).toBe("on");
  });
});

describe("CheckboxItem", () => {
  it("names the checkbox with its label and toggles when the label is clicked", async () => {
    render(<CheckboxItem label="Remember me" />);

    await userEvent.click(screen.getByText("Remember me"));

    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
  });

  it("describes the checkbox with the help text", () => {
    render(<CheckboxItem label="Remember me" description="Only on this device" />);

    expect(screen.getByRole("checkbox", { name: "Remember me" })).toHaveAccessibleDescription(
      "Only on this device",
    );
  });

  it("has no description when there is no help text", () => {
    render(<CheckboxItem label="Remember me" />);

    expect(screen.getByRole("checkbox")).not.toHaveAttribute("aria-describedby");
  });

  it("is disabled together with its label", async () => {
    render(<CheckboxItem label="Remember me" disabled />);

    await userEvent.click(screen.getByText("Remember me"));

    expect(screen.getByRole("checkbox", { name: "Remember me" })).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("gives each item its own ids", () => {
    render(
      <>
        <CheckboxItem label="One" />
        <CheckboxItem label="Two" />
      </>,
    );

    expect(screen.getByRole("checkbox", { name: "One" }).id).not.toBe(
      screen.getByRole("checkbox", { name: "Two" }).id,
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<CheckboxItem label="Remember me" description="Only here" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
