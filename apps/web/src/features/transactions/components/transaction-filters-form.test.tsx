import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { NO_FILTERS, type TransactionFilters } from "../lib/transaction-filters";
import { TransactionFiltersForm } from "./transaction-filters-form";

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

const today = new Date(2026, 9, 14, 15, 30);

function setup(value: TransactionFilters = NO_FILTERS, layout: "panel" | "sheet" = "panel") {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => Promise.resolve({ data: operation.operationId === "listAssets" ? [apple] : [] }),
  );
  const onApply = vi.fn();
  const onCancel = vi.fn();
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <TransactionFiltersForm
        layout={layout}
        onApply={onApply}
        onCancel={onCancel}
        today={today}
        value={value}
      />
    </Wrapper>,
  );
  return { onApply, onCancel, user: userEvent.setup() };
}

describe("TransactionFiltersForm", () => {
  it("shows the type, the asset and the date with nothing chosen", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Buy" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sell" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Asset" })).toHaveTextContent("All assets");
    expect(screen.getByRole("button", { name: /Date/ })).toHaveTextContent("Any date");
  });

  it("starts from the filters in force", () => {
    setup({
      types: ["SELL"],
      asset: apple,
      range: { from: "2026-10-01", to: "2026-10-14" },
    });

    expect(screen.getByRole("checkbox", { name: "Sell" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Asset" })).toHaveTextContent("AAPL · Apple Inc.");
    expect(screen.getByRole("button", { name: /Date/ })).toHaveTextContent(
      "Oct 1, 2026 – Oct 14, 2026",
    );
  });

  it("cannot apply until the draft differs from what is in force", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Buy" }));

    expect(screen.getByRole("button", { name: "Apply filters" })).toBeEnabled();
    await user.click(screen.getByRole("checkbox", { name: "Buy" }));
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();
  });

  it("applies the type, the asset and the range that were chosen", async () => {
    const { user, onApply } = setup();

    await user.click(screen.getByRole("checkbox", { name: "Buy" }));
    await user.click(screen.getByRole("combobox", { name: "Asset" }));
    await user.click(await screen.findByRole("option", { name: "AAPL · Apple Inc." }));
    await user.click(screen.getByRole("button", { name: /Date/ }));
    await user.click(screen.getByRole("button", { name: "Last 7 days" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledWith({
      types: ["BUY"],
      asset: apple,
      range: { from: "2026-10-08", to: "2026-10-14" },
    });
  });

  it("clears the draft with Clear all, and then it asks for nothing", async () => {
    const { user, onApply } = setup({ ...NO_FILTERS, types: ["SELL"] });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByRole("checkbox", { name: "Sell" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onApply).toHaveBeenCalledWith(NO_FILTERS);
  });

  it("closes without applying on Cancel", async () => {
    const { user, onApply, onCancel } = setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("in the mobile sheet has Clear next to Apply filters, and no Cancel", async () => {
    const { user } = setup({ ...NO_FILTERS, types: ["BUY"] }, "sheet");

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Date/ })).toHaveTextContent("Select a date range");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("checkbox", { name: "Buy" })).not.toBeChecked();
  });
});
