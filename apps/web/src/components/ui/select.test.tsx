import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Field } from "./field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

function CurrencySelect({
  onValueChange,
  value,
  disabled,
}: {
  onValueChange?: (value: string) => void;
  value?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      {...(onValueChange ? { onValueChange } : {})}
      {...(value ? { value } : {})}
      {...(disabled ? { disabled } : {})}
    >
      <SelectTrigger aria-label="Currency">
        <SelectValue placeholder="Select a currency" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="EUR">EUR</SelectItem>
        <SelectItem disabled value="GBP">
          GBP
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("shows the placeholder until the user picks an option", () => {
    render(<CurrencySelect />);

    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(
      "Select a currency",
    );
  });

  it("does not take the Input's editing border, because the Figma Select has no Editing state", () => {
    render(<CurrencySelect />);

    expect(screen.getByRole("combobox", { name: "Currency" }).className).not.toContain(
      "input-border-editing",
    );
  });

  it("lists the options when opened and shows the one the user picks", async () => {
    const onValueChange = vi.fn();
    render(<CurrencySelect onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Currency" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "USD",
      "EUR",
      "GBP",
    ]);

    await userEvent.click(screen.getByRole("option", { name: "EUR" }));

    expect(onValueChange).toHaveBeenCalledWith("EUR");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("EUR");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("works from the keyboard", async () => {
    const onValueChange = vi.fn();
    render(<CurrencySelect onValueChange={onValueChange} />);

    await userEvent.tab();
    await userEvent.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("EUR");
  });

  it("marks the chosen option and does not offer a disabled one", async () => {
    const onValueChange = vi.fn();
    render(<CurrencySelect onValueChange={onValueChange} value="USD" />);

    await userEvent.click(screen.getByRole("combobox", { name: "Currency" }));

    expect(screen.getByRole("option", { name: "USD" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "GBP" })).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(screen.getByRole("option", { name: "GBP" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not open when it is disabled", async () => {
    render(<CurrencySelect disabled />);

    const trigger = screen.getByRole("combobox", { name: "Currency" });
    await userEvent.click(trigger);

    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("takes its label, description, required and error state from the field around it", () => {
    render(
      <Field error="Choose a currency" label="Base currency" required>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );

    const trigger = screen.getByRole("combobox", { name: /Base currency/ });

    expect(trigger).toBeInvalid();
    expect(trigger).toBeRequired();
    expect(trigger).toHaveAccessibleDescription("Choose a currency");
  });

  it("has the size of the Input it sits next to, 36 px by default", () => {
    render(<CurrencySelect />);

    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveClass("h-9");
  });

  it("has no accessibility violations inside a field, closed and open", async () => {
    const { container } = render(
      <Field label="Base currency">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select a currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("combobox", { name: "Base currency" }));

    expect(await axe(screen.getByRole("listbox"))).toHaveNoViolations();
  });
});
