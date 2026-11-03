import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { AnalyticsDrawdownPanel } from "./analytics-drawdown-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const day = (date: string, returnPercent: number | null) => ({
  date,
  value: usd("100000.00"),
  returnPercent,
});

// Index: 1, 1.05, 0.9975 (a 5% fall from the high), 1.047375 (back up, 0.25% under the high).
const performance = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-10-01",
  status: "OK",
  twrPercent: 4.7375,
  pnl: usd("4737.50"),
  series: [
    day("2026-10-01", null),
    day("2026-10-02", 5),
    day("2026-10-03", -5),
    day("2026-10-04", 5),
  ],
};

const month: AnalyticsPeriod = { kind: "preset", period: "1M" };

function renderPanel(
  answer: () => Promise<unknown> = () => Promise.resolve({ data: performance }),
  emptyPortfolio = false,
) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  render(
    <AnalyticsDrawdownPanel emptyPortfolio={emptyPortfolio} period={month} portfolioId="p1" />,
    {
      wrapper: tradingClientWrapper({ call }),
    },
  );
  return call;
}

const insufficient = () =>
  Promise.resolve({
    data: { ...performance, status: "INSUFFICIENT_DATA", twrPercent: null, series: [] },
  });

describe("AnalyticsDrawdownPanel", () => {
  it("draws the drawdown and says how deep it was and when", async () => {
    renderPanel();

    expect(await screen.findByRole("img", { name: /Drawdown of the portfolio/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Drawdown" })).toBeVisible();
    expect(screen.getByText(/^Fall from the previous high · low -5\.0% on /)).toBeVisible();
  });

  it("describes the chart in words for a screen reader", async () => {
    renderPanel();

    expect(
      await screen.findByText(/fell at most -5\.0% below its previous high/),
    ).toBeInTheDocument();
  });

  it("only says what it measures when the portfolio never fell", async () => {
    renderPanel(() =>
      Promise.resolve({
        data: {
          ...performance,
          series: [day("2026-10-01", null), day("2026-10-02", 2), day("2026-10-03", 1)],
        },
      }),
    );

    await screen.findByRole("img");
    expect(screen.getByText("Fall from the previous high")).toBeVisible();
  });

  it("holds the place of the chart while it loads", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the drawdown" })).toBeVisible();
  });

  it("says there is no drawdown yet for an empty portfolio", async () => {
    renderPanel(insufficient, true);

    expect(await screen.findByText("No drawdown yet")).toBeVisible();
    expect(screen.getByText("It shows from your first day with positions.")).toBeVisible();
  });

  it("says the period has no data", async () => {
    renderPanel(insufficient);

    expect(await screen.findByText("No data in this range")).toBeVisible();
    expect(screen.getByText("There are no falls to show in this period.")).toBeVisible();
  });

  it("fails on its own, with a retry that asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPanel(() =>
      fail
        ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
        : Promise.resolve({ data: performance }),
    );

    expect(await screen.findByText("Could not load the drawdown")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("img")).toBeVisible();
  });
});
