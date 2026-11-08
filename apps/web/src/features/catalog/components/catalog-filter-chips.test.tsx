import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { NO_CATALOG_FILTERS, type CatalogFilters } from "../lib/catalog-filters";
import { CatalogFilterChips } from "./catalog-filter-chips";

function renderChips(value: CatalogFilters) {
  const onChange = vi.fn();
  const view = render(<CatalogFilterChips onChange={onChange} value={value} />);
  return { onChange, ...view };
}

describe("CatalogFilterChips", () => {
  it("takes no room when no filter narrows the list", () => {
    const { container } = renderChips(NO_CATALOG_FILTERS);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a chip for each filter in force, with the exchange by its usual name", () => {
    renderChips({ assetType: "ETF", exchange: "NYSEARCA" });

    const chips = within(screen.getByRole("list", { name: "Active filters" }));
    expect(chips.getByText("Type: ETF")).toBeVisible();
    expect(chips.getByText("Exchange: NYSE Arca")).toBeVisible();
  });

  it("removes only the filter whose 'x' is pressed", async () => {
    const user = userEvent.setup();
    const { onChange } = renderChips({ assetType: "ETF", exchange: "NASDAQ" });

    await user.click(screen.getByRole("button", { name: "Remove filter Type: ETF" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ assetType: null, exchange: "NASDAQ" });
  });

  it("clears them all with 'Clear all'", async () => {
    const user = userEvent.setup();
    const { onChange } = renderChips({ assetType: "ETF", exchange: "NASDAQ" });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(NO_CATALOG_FILTERS);
  });
});
