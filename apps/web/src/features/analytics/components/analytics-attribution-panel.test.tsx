import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { AnalyticsAttributionPanel } from "./analytics-attribution-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const attribution = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-09-14",
  status: "OK",
  groupBy: "asset",
  pnl: usd("2500.00"),
  groups: [
    { key: "nvda", label: "NVDA", contribution: usd("-700.00") },
    { key: "aapl", label: "AAPL", contribution: usd("4300.00") },
    { key: "ko", label: "KO", contribution: usd("0.00") },
  ],
};

const month: AnalyticsPeriod = { kind: "preset", period: "1M" };

function renderPanel(
  answer: () => Promise<unknown> = () => Promise.resolve({ data: attribution }),
  emptyPortfolio = false,
) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  render(
    <AnalyticsAttributionPanel emptyPortfolio={emptyPortfolio} period={month} portfolioId="p1" />,
    { wrapper: tradingClientWrapper({ call }) },
  );
  return call;
}

const insufficient = () =>
  Promise.resolve({
    data: { ...attribution, status: "INSUFFICIENT_DATA", pnl: null, groups: [] },
  });

describe("AnalyticsAttributionPanel", () => {
  it("lists what each asset added, from the most to the least, with its signed amount", async () => {
    renderPanel();

    const rows = within(await screen.findByRole("table"))
      .getAllByRole("row")
      .slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "AAPL+$4,300.00",
      "KO$0.00",
      "NVDA-$700.00",
    ]);
  });

  it("names the columns and says what the whole period added", async () => {
    renderPanel();

    expect(await screen.findByRole("columnheader", { name: "Asset" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Contribution" })).toBeVisible();
    expect(
      screen.getByText("What each asset added to the result of the period · +$2,500.00"),
    ).toBeVisible();
  });

  it("asks for the period of the screen", async () => {
    const call = renderPanel();

    await screen.findByRole("table");

    expect(call.mock.calls[0]?.[1]).toMatchObject({ query: { period: "1M", groupBy: "asset" } });
  });

  it("holds the place of the table while it loads", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the attribution" })).toBeVisible();
  });

  it("says there is no attribution yet for an empty portfolio", async () => {
    renderPanel(insufficient, true);

    expect(await screen.findByText("No attribution yet")).toBeVisible();
  });

  it("says the period has no data", async () => {
    renderPanel(insufficient);

    expect(await screen.findByText("No data in this range")).toBeVisible();
    expect(screen.getByText("There are no results to attribute in this period.")).toBeVisible();
  });

  it("fails on its own, with a retry that asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPanel(() =>
      fail
        ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
        : Promise.resolve({ data: attribution }),
    );

    expect(await screen.findByText("Could not load the attribution")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("table")).toBeVisible();
  });
});
