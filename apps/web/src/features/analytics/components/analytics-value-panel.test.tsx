import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { AnalyticsValuePanel } from "./analytics-value-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const performance = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-10-01",
  status: "OK",
  twrPercent: 6.12,
  pnl: usd("2500.00"),
  series: [
    { date: "2026-10-01", value: usd("118000.00"), returnPercent: null },
    { date: "2026-10-02", value: usd("121000.00"), returnPercent: 2.54 },
    { date: "2026-10-03", value: usd("124300.00"), returnPercent: 2.73 },
  ],
};

const month: AnalyticsPeriod = { kind: "preset", period: "1M" };

function renderPanel(
  answer: () => Promise<unknown> = () => Promise.resolve({ data: performance }),
  props: { emptyPortfolio?: boolean; onNew?: () => void; period?: AnalyticsPeriod } = {},
) {
  const call =
    vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(answer);
  const onShowLastMonth = vi.fn();
  render(
    <AnalyticsValuePanel
      emptyPortfolio={props.emptyPortfolio ?? false}
      onNew={props.onNew}
      onShowLastMonth={onShowLastMonth}
      period={props.period ?? month}
      portfolioId="p1"
    />,
    { wrapper: tradingClientWrapper({ call }) },
  );
  return { call, onShowLastMonth };
}

describe("AnalyticsValuePanel", () => {
  it("draws the value of the period with its title, its currency and the return in the legend", async () => {
    renderPanel();

    expect(await screen.findByRole("img", { name: /Portfolio value/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Portfolio value" })).toBeVisible();
    expect(screen.getByText("Evolution in USD · 1M")).toBeVisible();
    expect(screen.getByText("Portfolio")).toBeVisible();
    expect(screen.getByText("+6.12%")).toBeVisible();
  });

  it("asks for the period it is given", async () => {
    const { call } = renderPanel(undefined, {
      period: { kind: "custom", from: "2026-10-01", to: "2026-10-14" },
    });

    await screen.findByRole("img");
    expect(call.mock.calls[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      query: { from: "2026-10-01", to: "2026-10-14" },
    });
  });

  it("holds the place of the chart while it loads", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the portfolio value" })).toBeVisible();
  });

  it("says the portfolio is empty and offers to record a transaction", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    renderPanel(
      () =>
        Promise.resolve({
          data: { ...performance, status: "INSUFFICIENT_DATA", twrPercent: null, series: [] },
        }),
      { emptyPortfolio: true, onNew },
    );

    expect(await screen.findByText("Your portfolio is empty")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New transaction" }));

    expect(onNew).toHaveBeenCalledOnce();
  });

  it("says the period has no data and goes back to the last month", async () => {
    const user = userEvent.setup();
    const { onShowLastMonth } = renderPanel(() =>
      Promise.resolve({
        data: { ...performance, status: "INSUFFICIENT_DATA", twrPercent: null, series: [] },
      }),
    );

    expect(await screen.findByText("No data in this range")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "See the last month" }));

    expect(onShowLastMonth).toHaveBeenCalledOnce();
  });

  it("fails on its own, with a retry that asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    const { call } = renderPanel(() =>
      fail
        ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
        : Promise.resolve({ data: performance }),
    );

    expect(await screen.findByText("Could not load the portfolio value")).toBeVisible();
    expect(screen.getByText(/Your other data is still available/)).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("img")).toBeVisible();
    await waitFor(() => {
      expect(call.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
