import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { NO_CATALOG_FILTERS, type CatalogFilters } from "../lib/catalog-filters";
import { CatalogFiltersButton } from "./catalog-filters-button";

function renderButton(value: CatalogFilters = NO_CATALOG_FILTERS) {
  const onApply = vi.fn();
  render(<CatalogFiltersButton onApply={onApply} value={value} />);
  return onApply;
}

describe("CatalogFiltersButton", () => {
  it("says only 'Filters' while nothing narrows the list", () => {
    renderButton();

    expect(screen.getByRole("button", { name: "Filters" })).toBeVisible();
  });

  it("says how many filters narrow the list", () => {
    renderButton({ assetType: "ETF", exchange: "NASDAQ" });

    expect(screen.getByRole("button", { name: "Filters · 2" })).toBeVisible();
  });

  it("opens the form, applies the draft and closes", async () => {
    const user = userEvent.setup();
    const onApply = renderButton();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith({ assetType: "ETF", exchange: null });
    expect(screen.queryByRole("checkbox", { name: "ETF" })).not.toBeInTheDocument();
  });

  it("closes with 'Cancel' without applying, and the next opening starts from the filters in force", async () => {
    const user = userEvent.setup();
    const onApply = renderButton();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: "ETF" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "ETF" })).not.toBeChecked();
  });
});
