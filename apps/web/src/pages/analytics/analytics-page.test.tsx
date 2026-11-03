import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AnalyticsPage } from "./analytics-page";

const growth = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const position = (id: string) => ({ id, portfolioId: "p1", assetId: `a-${id}` });

const performance = {
  asOf: "2026-10-14",
  effectiveFrom: "2026-09-14",
  status: "OK",
  twrPercent: 6.12,
  pnl: { amount: "2500.00", currency: "USD" },
  series: [],
};

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

interface Answers {
  listPortfolios?: () => Promise<unknown>;
  listPositions?: () => Promise<unknown>;
}

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "listPortfolios":
          return answers.listPortfolios?.() ?? Promise.resolve({ data: [growth] });
        case "listPositions":
          return (
            answers.listPositions?.() ?? Promise.resolve({ data: [position("s1"), position("s2")] })
          );
        case "getPortfolioPerformance":
          return Promise.resolve({ data: performance });
        case "getPortfolioRisk":
          return Promise.resolve({ data: risk });
        case "getPortfolioAllocation":
          return Promise.resolve({
            data: {
              groupBy: "asset",
              groups: [
                {
                  key: "a1",
                  label: "AAPL",
                  marketValue: { amount: "100.00", currency: "USD" },
                  percentage: 34,
                },
              ],
            },
          });
        default:
          return Promise.reject(new Error(`unexpected ${operation.operationId}`));
      }
    },
  );
  return { client: { call } as TradingClient, call };
}

function renderPage(client: TradingClient) {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    </Wrapper>,
  );
}

const callsOf = (call: ReturnType<typeof clientWith>["call"], operationId: string) =>
  call.mock.calls.filter(([operation]) => operation.operationId === operationId);

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
});

describe("AnalyticsPage", () => {
  it("names the page for screen readers", () => {
    renderPage(clientWith().client);

    expect(screen.getByRole("heading", { level: 1, name: "Analytics" })).toBeInTheDocument();
  });

  it("writes the summary line and shows the indicators of the active portfolio", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByText("Summary of Growth · 2 positions")).toBeVisible();
    const kpi = (name: string) => within(screen.getByRole("region", { name }));
    expect(await kpi("Period return").findByText("+6.12%")).toBeVisible();
    expect(await kpi("Volatility").findByText("14.2%")).toBeVisible();
    expect(await kpi("Concentration").findByText("34%")).toBeVisible();
  });

  it("opens on the month and asks again when another period is chosen", async () => {
    const user = userEvent.setup();
    const { client, call } = clientWith();
    renderPage(client);
    await screen.findByText("+6.12%");
    expect(callsOf(call, "getPortfolioRisk")[0]?.[1]).toMatchObject({ query: { period: "1M" } });

    await user.click(screen.getByRole("button", { name: "3M" }));

    await waitFor(() => {
      expect(callsOf(call, "getPortfolioRisk").at(-1)?.[1]).toMatchObject({
        query: { period: "3M" },
      });
    });
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true");
  });

  it("writes the summary line of a portfolio with no positions", async () => {
    renderPage(
      clientWith({
        listPositions: () => Promise.resolve({ data: [] }),
        listPortfolios: () => Promise.resolve({ data: [growth] }),
      }).client,
    );

    expect(await screen.findByText("Summary of Growth · 0 positions")).toBeVisible();
  });

  it("asks for a portfolio when the user has none", async () => {
    renderPage(clientWith({ listPortfolios: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("You have no portfolios yet")).toBeInTheDocument();
  });

  it("offers a retry when the portfolios cannot load", async () => {
    renderPage(
      clientWith({
        listPortfolios: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
      }).client,
    );

    expect(await screen.findByText("Could not load the analytics")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
