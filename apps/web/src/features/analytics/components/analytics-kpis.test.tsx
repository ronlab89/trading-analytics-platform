import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import type { AnalyticsPeriod } from "../lib/analytics-period";
import { AnalyticsKpis } from "./analytics-kpis";

const group = (label: string, percentage: number) => ({
  key: label,
  label,
  marketValue: { amount: "100.00", currency: "USD" },
  percentage,
});

const risk = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-09-14",
  status: "OK",
  volatilityPercent: 14.2,
  maxDrawdownPercent: -8.4,
  currentDrawdownPercent: -1,
  peakDate: "2026-09-10",
  troughDate: "2026-09-22",
};

const performance = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-09-14",
  status: "OK",
  twrPercent: 6.12,
  pnl: { amount: "2500.00", currency: "USD" },
  series: [],
};

const allocation = { groupBy: "asset", groups: [group("AAPL", 34), group("MSFT", 22)] };

interface Answers {
  performance?: () => Promise<unknown>;
  risk?: () => Promise<unknown>;
  allocation?: () => Promise<unknown>;
}

const month: AnalyticsPeriod = { kind: "preset", period: "1M" };

function renderKpis(
  answers: Answers = {},
  period: AnalyticsPeriod = month,
  emptyPortfolio = false,
) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "getPortfolioPerformance":
          return answers.performance?.() ?? Promise.resolve({ data: performance });
        case "getPortfolioRisk":
          return answers.risk?.() ?? Promise.resolve({ data: risk });
        default:
          return answers.allocation?.() ?? Promise.resolve({ data: allocation });
      }
    },
  );
  render(
    <AnalyticsKpis
      emptyPortfolio={emptyPortfolio}
      period={period}
      portfolioId="p1"
      portfolioName="Growth"
    />,
    {
      wrapper: tradingClientWrapper({ call }),
    },
  );
  return call;
}

const card = (name: string) => within(screen.getByRole("region", { name }));

describe("AnalyticsKpis", () => {
  it("shows the four indicators of the Figma with their notes", async () => {
    renderKpis();

    expect(await card("Period return").findByText("+6.12%")).toBeVisible();
    expect(card("Period return").getByText("Growth · 1M")).toBeVisible();
    expect(await card("Volatility").findByText("14.2%")).toBeVisible();
    expect(card("Volatility").getByText("Annualized · 1M")).toBeVisible();
    expect(await card("Maximum drawdown").findByText("-8.4%")).toBeVisible();
    expect(card("Maximum drawdown").getByText("From the period's high")).toBeVisible();
    expect(await card("Concentration").findByText("34%")).toBeVisible();
    expect(card("Concentration").getByText("Largest weight: AAPL · moderate risk")).toBeVisible();
  });

  it("asks for the period chosen, and writes a custom range in the notes", async () => {
    const call = renderKpis({}, { kind: "custom", from: "2026-10-01", to: "2026-10-14" });

    expect(await card("Volatility").findByText("14.2%")).toBeVisible();
    const performanceCall = call.mock.calls.find(
      ([operation]) => operation.operationId === "getPortfolioPerformance",
    );
    expect(performanceCall?.[1]?.query).toEqual({ from: "2026-10-01", to: "2026-10-14" });
    expect(card("Volatility").getByText(/Annualized · .*Oct/)).toBeVisible();
  });

  it("holds the place of every figure while it loads", () => {
    renderKpis({
      performance: () => new Promise(() => undefined),
      risk: () => new Promise(() => undefined),
      allocation: () => new Promise(() => undefined),
    });

    expect(card("Period return").queryByText(/%/)).not.toBeInTheDocument();
    expect(card("Concentration").queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows a dash and says there is not enough data when a value is unavailable", async () => {
    renderKpis({
      performance: () =>
        Promise.resolve({
          data: { ...performance, status: "INSUFFICIENT_DATA", twrPercent: null },
        }),
      risk: () =>
        Promise.resolve({
          data: {
            ...risk,
            status: "INSUFFICIENT_DATA",
            volatilityPercent: null,
            maxDrawdownPercent: null,
          },
        }),
      allocation: () => Promise.resolve({ data: { groupBy: "asset", groups: [] } }),
    });

    expect(await card("Period return").findByText("No data in this range")).toBeVisible();
    expect(await card("Volatility").findByText("No data in this range")).toBeVisible();
    expect(await card("Maximum drawdown").findByText("No data in this range")).toBeVisible();
    expect(await card("Concentration").findByText("No data in this range")).toBeVisible();
    expect(card("Volatility").getByText("—")).toBeVisible();
  });

  it("says there are no transactions, not that the range is empty, for a portfolio with no positions", async () => {
    renderKpis(
      {
        performance: () =>
          Promise.resolve({
            data: { ...performance, status: "INSUFFICIENT_DATA", twrPercent: null },
          }),
        allocation: () => Promise.resolve({ data: { groupBy: "asset", groups: [] } }),
      },
      month,
      true,
    );

    expect(await card("Period return").findByText("No transactions")).toBeVisible();
    expect(await card("Concentration").findByText("No transactions")).toBeVisible();
  });

  it("marks a failed indicator without taking the others down", async () => {
    renderKpis({ risk: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")) });

    expect(await card("Volatility").findByText("Could not be loaded")).toBeVisible();
    expect(card("Maximum drawdown").getByText("Could not be loaded")).toBeVisible();
    expect(await card("Period return").findByText("+6.12%")).toBeVisible();
    expect(await card("Concentration").findByText("34%")).toBeVisible();
  });

  it("has no accessibility violations", async () => {
    renderKpis();
    await card("Period return").findByText("+6.12%");

    expect(await axe(document.body)).toHaveNoViolations();
  });
});
