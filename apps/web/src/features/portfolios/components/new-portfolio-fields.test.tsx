import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import {
  emptyPortfolioForm,
  portfolioFormSchema,
  type PortfolioFormValues,
} from "../lib/portfolio-form";
import { NewPortfolioFields } from "./new-portfolio-fields";

function Harness({
  onValid = vi.fn(),
  disabled = false,
}: {
  onValid?: (values: unknown) => void;
  disabled?: boolean;
}) {
  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: emptyPortfolioForm,
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onValid)(event);
      }}
    >
      <NewPortfolioFields disabled={disabled} form={form} />
      <button type="submit">Send</button>
    </form>
  );
}

async function pickCurrency(label: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /Base currency/ }));
  await userEvent.click(screen.getByRole("option", { name: label }));
}

describe("NewPortfolioFields", () => {
  it("asks for the name and the base currency, and leaves the description optional", () => {
    render(<Harness />);

    expect(screen.getByRole("textbox", { name: /Name/ })).toBeRequired();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toBeRequired();
    expect(screen.getByRole("textbox", { name: /Description/ })).not.toBeRequired();
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveAttribute(
      "placeholder",
      "e.g. Long term",
    );
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toHaveTextContent(
      "Select a currency",
    );
  });

  it("warns that the base currency cannot be changed later", () => {
    render(<Harness />);

    expect(screen.getByRole("combobox", { name: /Base currency/ })).toHaveAccessibleDescription(
      "You won't be able to change it after creating it.",
    );
  });

  it("offers USD, EUR, GBP and COP with their names", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("combobox", { name: /Base currency/ }));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "USD · US dollar",
      "EUR · Euro",
      "GBP · Pound sterling",
      "COP · Colombian peso",
    ]);
  });

  it("shows the chosen currency with its name", async () => {
    render(<Harness />);

    await pickCurrency("EUR · Euro");

    expect(screen.getByRole("combobox", { name: /Base currency/ })).toHaveTextContent("EUR · Euro");
  });

  it("explains what is missing when sent empty, and sends nothing", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByText("Select a base currency.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeInvalid();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toBeInvalid();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("clears an error as soon as the user fixes that field", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Enter a name");

    await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "Growth");
    await pickCurrency("USD · US dollar");

    await waitFor(() => {
      expect(screen.queryByText("Enter a name")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Select a base currency.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toHaveAccessibleDescription(
      "You won't be able to change it after creating it.",
    );
  });

  it("treats a name of spaces as missing", async () => {
    render(<Harness />);

    await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "   ");
    await pickCurrency("USD · US dollar");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
  });

  it("hands over the trimmed values once everything is filled in", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);

    await userEvent.type(screen.getByRole("textbox", { name: /Name/ }), "  Growth ");
    await userEvent.type(screen.getByRole("textbox", { name: /Description/ }), "Stable income");
    await pickCurrency("COP · Colombian peso");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onValid).toHaveBeenCalled();
    });
    expect(onValid.mock.calls[0]?.[0]).toEqual({
      name: "Growth",
      description: "Stable income",
      baseCurrency: "COP",
    });
  });

  it("locks every field while it is disabled", () => {
    render(<Harness disabled />);

    expect(screen.getByRole("textbox", { name: /Name/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Description/ })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /Base currency/ })).toBeDisabled();
  });

  it("draws the description box 36 px tall like the Figma dialog, but it can still grow", () => {
    render(<Harness />);

    const description = screen.getByRole("textbox", { name: /Description/ });

    expect(description).toHaveClass("min-h-9");
    expect(description).toHaveAttribute("rows", "1");
  });

  it("has no accessibility violations, with and without errors", async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Enter a name");

    expect(await axe(container)).toHaveNoViolations();
  });
});
