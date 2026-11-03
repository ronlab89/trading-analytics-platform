import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AnalyticsAllocationPanel } from "./analytics-allocation-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const byAsset = {
  groupBy: "asset",
  groups: [
    { key: "ko", label: "KO", marketValue: usd("15052.00"), percentage: 12 },
    { key: "aapl", label: "AAPL", marketValue: usd("42646.00"), percentage: 34 },
    { key: "msft", label: "MSFT", marketValue: usd("27595.00"), percentage: 22 },
  ],
};

const byType = {
  groupBy: "assetType",
  groups: [{ key: "STOCK", label: "STOCK", marketValue: usd("85293.00"), percentage: 100 }],
};

const answerFor = (groupBy: string) =>
  Promise.resolve({ data: groupBy === "assetType" ? byType : byAsset });

function renderPanel(answer: (groupBy: string) => Promise<unknown> = answerFor) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (_operation, input) => answer(String(input?.query?.groupBy)),
  );
  render(<AnalyticsAllocationPanel portfolioId="p1" />, {
    wrapper: tradingClientWrapper({ call }),
  });
  return call;
}

describe("AnalyticsAllocationPanel", () => {
  it("lists the assets from the largest, each with its amount and weight", async () => {
    renderPanel();

    const items = within(await screen.findByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "AAPL$42,646.0034.0%",
      "MSFT$27,595.0022.0%",
      "KO$15,052.0012.0%",
    ]);
  });

  it("says how much the weights are over", async () => {
    renderPanel();

    expect(await screen.findByText("Weight over $85,293.00 invested")).toBeVisible();
  });

  it("groups by asset first and asks again for the type when its tab is chosen", async () => {
    const user = userEvent.setup();
    const call = renderPanel();
    await screen.findByRole("list");

    await user.click(screen.getByRole("tab", { name: "Type" }));

    expect(await screen.findByText("Stock")).toBeVisible();
    expect(call).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ query: { groupBy: "assetType" } }),
    );
  });

  it("holds the place of the rows while they load", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the allocation" })).toBeVisible();
  });

  it("says there is nothing to allocate for an empty portfolio", async () => {
    renderPanel(() => Promise.resolve({ data: { groupBy: "asset", groups: [] } }));

    expect(await screen.findByText("Nothing to allocate yet")).toBeVisible();
    expect(screen.getByText("It shows from your first position.")).toBeVisible();
  });

  it("fails on its own, with a retry that asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPanel(() =>
      fail
        ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
        : Promise.resolve({ data: byAsset }),
    );

    expect(await screen.findByText("Could not load the allocation")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("list")).toBeVisible();
  });
});
