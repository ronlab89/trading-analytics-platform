import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { NO_CATALOG_FILTERS, type CatalogFilters } from "../lib/catalog-filters";
import { CatalogFiltersForm } from "./catalog-filters-form";

function renderForm(
  value: CatalogFilters = NO_CATALOG_FILTERS,
  layout: "panel" | "sheet" = "panel",
) {
  const onApply = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <CatalogFiltersForm layout={layout} onApply={onApply} onCancel={onCancel} value={value} />,
  );
  return { onApply, onCancel, ...view };
}

describe("CatalogFiltersForm", () => {
  it("offers the types and the exchanges of the Figma, with the exchanges by their usual names", () => {
    renderForm();

    for (const name of [
      "Stock",
      "ETF",
      "Crypto",
      "Forex",
      "NASDAQ",
      "NYSE",
      "NYSE Arca",
      "Global",
    ]) {
      expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
    }
  });

  it("starts from the filters in force, and applying waits for a change", () => {
    renderForm({ assetType: "ETF", exchange: "NASDAQ" });

    expect(screen.getByRole("checkbox", { name: "ETF" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "NASDAQ" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  });

  it("allows one box in each group: choosing another replaces the one chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("checkbox", { name: "Stock" }));

    expect(screen.getByRole("checkbox", { name: "Stock" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "ETF" })).not.toBeChecked();
  });

  it("keeps the two groups apart: a type and an exchange can both be chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("checkbox", { name: "NYSE Arca" }));

    expect(screen.getByRole("checkbox", { name: "ETF" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "NYSE Arca" })).toBeChecked();
  });

  it("applies the draft with the API code of the exchange", async () => {
    const user = userEvent.setup();
    const { onApply } = renderForm();

    await user.click(screen.getByRole("checkbox", { name: "Global" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith({ assetType: null, exchange: "CRYPTO" });
  });

  it("unchecking the box in force leaves the group open", async () => {
    const user = userEvent.setup();
    const { onApply } = renderForm({ assetType: "ETF", exchange: null });

    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith(NO_CATALOG_FILTERS);
  });

  it("clears the draft with 'Clear all', which waits for something to clear", async () => {
    const user = userEvent.setup();
    renderForm({ assetType: "ETF", exchange: "NASDAQ" });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByRole("checkbox", { name: "ETF" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "NASDAQ" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  it("cancels without applying", async () => {
    const user = userEvent.setup();
    const { onApply, onCancel } = renderForm();

    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("is the mobile sheet with 'Clear' beside 'Apply filters' and no 'Cancel'", () => {
    renderForm(NO_CATALOG_FILTERS, "sheet");

    expect(screen.getByRole("button", { name: "Clear" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderForm();

    expect(await axe(container)).toHaveNoViolations();
  });
});
