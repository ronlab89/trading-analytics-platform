import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse } from "@trading/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { NO_FILTERS, type TransactionFilters } from "../lib/transaction-filters";
import { TransactionFiltersButton } from "./transaction-filters-button";

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

function setup(value: TransactionFilters = NO_FILTERS) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    () => Promise.resolve({ data: [apple] }),
  );
  const onApply = vi.fn();
  const Wrapper = tradingClientWrapper({ call });
  render(
    <Wrapper>
      <TransactionFiltersButton onApply={onApply} value={value} />
    </Wrapper>,
  );
  return { onApply, user: userEvent.setup() };
}

function stubMobile() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 560px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

// Not `unstubAllGlobals`: that would also drop the ResizeObserver stub `setup.ts` installs once.
afterEach(() => {
  vi.stubGlobal("matchMedia", undefined);
});

describe("TransactionFiltersButton", () => {
  it("says Filters, and how many filters narrow the list once there are some", () => {
    setup({ types: ["SELL"], asset: apple, range: null });

    expect(screen.getByRole("button", { name: "Filters · 2" })).toBeInTheDocument();
  });

  it("opens the panel under the button and hands over what is applied, then closes", async () => {
    const { user, onApply } = setup();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("checkbox", { name: "Sell" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(onApply).toHaveBeenCalledWith({ types: ["SELL"], asset: null, range: null });
    expect(screen.queryByRole("checkbox", { name: "Sell" })).not.toBeInTheDocument();
  });

  it("closes without applying on Cancel, and opens again from the filters in force", async () => {
    const { user, onApply } = setup({ ...NO_FILTERS, types: ["BUY"] });

    await user.click(screen.getByRole("button", { name: "Filters · 1" }));
    await user.click(await screen.findByRole("checkbox", { name: "Sell" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Filters · 1" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(await screen.findByRole("checkbox", { name: "Sell" })).not.toBeChecked();
  });

  it("is a bottom sheet on mobile, with Clear instead of Cancel", async () => {
    stubMobile();
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    expect(sheet).toHaveAttribute("data-mobile-sheet");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
