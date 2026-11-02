import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { NO_FILTERS, type TransactionFilters } from "../lib/transaction-filters";
import { TransactionFilterChips } from "./transaction-filter-chips";

const apple: AssetResponse = {
  id: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
};

const thisYear = String(new Date().getFullYear());
const all: TransactionFilters = {
  types: ["BUY"],
  asset: apple,
  range: { from: `${thisYear}-01-02`, to: `${thisYear}-01-09` },
};

function setup(value: TransactionFilters) {
  const onChange = vi.fn();
  render(<TransactionFilterChips onChange={onChange} value={value} />);
  return { onChange, user: userEvent.setup() };
}

describe("TransactionFilterChips", () => {
  it("shows nothing while no filter narrows the list", () => {
    const { container } = render(<TransactionFilterChips onChange={vi.fn()} value={NO_FILTERS} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing for both types checked, which narrows nothing", () => {
    const { container } = render(
      <TransactionFilterChips
        onChange={vi.fn()}
        value={{ ...NO_FILTERS, types: ["BUY", "SELL"] }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a chip for the type, the asset and the range, and Clear all", () => {
    setup(all);

    const list = screen.getByRole("list", { name: "Active filters" });
    expect(within(list).getByText("Type: Buy")).toBeInTheDocument();
    expect(within(list).getByText("Asset: AAPL")).toBeInTheDocument();
    expect(within(list).getByText("Date: Jan 2 – Jan 9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();
  });

  it.each([
    ["Type: Buy", { ...all, types: [] }],
    ["Asset: AAPL", { ...all, asset: null }],
    ["Date: Jan 2 – Jan 9", { ...all, range: null }],
  ])("removes only the %s filter", async (chip, expected) => {
    const { user, onChange } = setup(all);

    await user.click(screen.getByRole("button", { name: `Remove filter ${chip}` }));

    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("clears every filter with Clear all", async () => {
    const { user, onChange } = setup(all);

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenCalledWith(NO_FILTERS);
  });
});
