import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DashboardPage } from "./dashboard-page";

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

interface Answers {
  listPortfolios?: () => Promise<unknown>;
  getPortfolioOverview?: () => Promise<unknown>;
  getPortfolioPerformance?: () => Promise<unknown>;
  listNotifications?: () => Promise<unknown>;
}

const performanceData = {
  data: {
    asOf: "2026-10-06",
    effectiveFrom: "2026-09-07",
    status: "OK",
    twrPercent: 4,
    pnl: { amount: "5000.00", currency: "USD" },
    series: [
      { date: "2026-09-07", value: { amount: "120000.00", currency: "USD" }, returnPercent: 1 },
      {
        date: "2026-09-08",
        value: { amount: "125000.00", currency: "USD" },
        returnPercent: 4.1667,
      },
    ],
  },
};

/** The part of the overview the page reads so far: the positions, the summary and today's change. */
const recentTransaction = {
  transaction: {
    id: "t1",
    portfolioId: "p1",
    assetId: "a1",
    type: "BUY",
    quantity: 10,
    price: { amount: "180.20", currency: "USD" },
    fees: { amount: "1.00", currency: "USD" },
    realizedPnL: null,
    status: "COMPLETED",
    executedAt: "2026-10-06T14:29:00.000Z",
    createdAt: "2026-10-06T14:29:00.000Z",
  },
  asset: { id: "a1", symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK" },
};

const overviewOf = (positions: number, recent: readonly unknown[] = [recentTransaction]) => ({
  data: {
    recentTransactions: recent,
    positions: Array.from({ length: positions }, (_, index) => ({
      id: index,
      asset: {
        id: `a${String(index)}`,
        symbol: `S${String(index)}`,
        name: "Asset",
        assetType: "STOCK",
      },
      dailyChange: {
        changeValue: { amount: "1.00", currency: "USD" },
        changePercent: index + 1,
      },
    })),
    allocation: {
      groupBy: "asset",
      groups: [
        {
          key: "a0",
          label: "S0",
          marketValue: { amount: "100.00", currency: "USD" },
          percentage: 100,
        },
      ],
    },
    pulse: { volatility: { classification: "MODERATE", value: 14.2, explanation: "" } },
    summary: {
      totalValue: { amount: "125430.25", currency: "USD" },
      investedValue: { amount: "107230.25", currency: "USD" },
      unrealizedPnL: { amount: "18200.00", currency: "USD" },
      unrealizedPnLPercent: 17,
    },
    dailyChange: { changeValue: { amount: "2340.10", currency: "USD" }, changePercent: 1.9 },
  },
});

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "listPortfolios":
          return answers.listPortfolios?.() ?? Promise.resolve({ data: [growth] });
        case "getPortfolioOverview":
          return answers.getPortfolioOverview?.() ?? Promise.resolve(overviewOf(5));
        case "getPortfolioPerformance":
          return answers.getPortfolioPerformance?.() ?? Promise.resolve(performanceData);
        case "listNotifications":
          return answers.listNotifications?.() ?? Promise.resolve({ data: [] });
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
        <DashboardPage />
      </MemoryRouter>
    </Wrapper>,
  );
}

function stubMobile(isMobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: isMobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
  stubMobile(false);
});

// Not `unstubAllGlobals`: that would also drop the ResizeObserver stub `setup.ts` installs once.
afterEach(() => {
  vi.stubGlobal("matchMedia", undefined);
});

describe("DashboardPage", () => {
  it("names the page for screen readers", () => {
    renderPage(clientWith().client);

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it("asks for the overview of the active portfolio, once", async () => {
    const { client, call } = clientWith();
    renderPage(client);

    await screen.findByText(/· Growth · 5 positions$/);

    const overviewCalls = call.mock.calls.filter(
      ([operation]) => operation.operationId === "getPortfolioOverview",
    );
    expect(overviewCalls).toHaveLength(1);
    expect(overviewCalls[0]?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("holds the place of the panels while the overview loads", async () => {
    renderPage(clientWith({ getPortfolioOverview: () => new Promise(() => undefined) }).client);

    expect(
      await screen.findByRole("status", { name: "Loading the dashboard" }),
    ).toBeInTheDocument();
  });

  it("says the day, the portfolio and its positions once the overview arrives", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByText(/· Growth · 5 positions$/)).toBeInTheDocument();
    expect(screen.getByText(/^Updated \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading the dashboard" })).not.toBeInTheDocument();
  });

  it("greets the user by first name and shows the value of the portfolio", async () => {
    useSessionStore.getState().signIn({
      user: { id: "u-1", email: "jane@example.com", displayName: "Jane Doe", role: "TRADER" },
      session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
    });
    renderPage(clientWith().client);

    expect(await screen.findByRole("heading", { name: "Hello, Jane" })).toBeInTheDocument();
    expect(screen.getByText("$125,430.25")).toBeInTheDocument();
    expect(screen.getByText("+$2,340.10")).toBeInTheDocument();
  });

  it("shows the total return of the open positions", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByText("+$18,200.00")).toBeInTheDocument();
    expect(screen.getByText("+17.00% gain")).toBeInTheDocument();
  });

  it("lists the recent transactions with the asset the overview names", async () => {
    renderPage(clientWith().client);

    const table = await screen.findByRole("table", { name: "Recent transactions" });
    expect(within(table).getByText("Apple Inc.")).toBeInTheDocument();
    expect(within(table).getByText("$1,802.00")).toBeInTheDocument();
  });

  it("offers a first transaction while the portfolio holds no positions", async () => {
    renderPage(
      clientWith({ getPortfolioOverview: () => Promise.resolve(overviewOf(0, [])) }).client,
    );

    // The header and the empty panel both offer it; either opens the same panel.
    const [header] = await screen.findAllByRole("button", { name: "New transaction" });
    if (!header) throw new Error("the header should offer a first transaction");
    await userEvent.click(header);

    expect(await screen.findByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
  });

  it("does not offer it once there are positions", async () => {
    renderPage(clientWith().client);
    await screen.findByText(/· Growth · 5 positions$/);

    expect(screen.queryByRole("button", { name: "New transaction" })).not.toBeInTheDocument();
  });

  it("says the overview failed and tries again on request", async () => {
    const getPortfolioOverview = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
      .mockResolvedValue(overviewOf(5));
    renderPage(clientWith({ getPortfolioOverview }).client);

    expect(await screen.findByText("Couldn't load the dashboard")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByText("Couldn't load the dashboard")).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/· Growth · 5 positions$/)).toBeInTheDocument();
  });

  it("draws the performance charts once the portfolio holds positions", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByRole("heading", { name: "Performance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Daily performance" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: /last months/i })).toBeInTheDocument();
  });

  it("shows the distribution, the risk level and the top movers from the overview", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByRole("heading", { name: "Distribution" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Risk level" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top movers" })).toBeInTheDocument();
  });

  it("shows what needs attention beside the daily performance", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(await screen.findByText("Nothing needs your attention")).toBeInTheDocument();
  });

  it("leaves those panels out while the portfolio holds no positions", async () => {
    renderPage(
      clientWith({ getPortfolioOverview: () => Promise.resolve(overviewOf(0, [])) }).client,
    );
    await screen.findAllByRole("button", { name: "New transaction" });

    expect(screen.queryByRole("heading", { name: "Distribution" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Risk level" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Top movers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Needs attention" })).not.toBeInTheDocument();
  });

  it("leaves the performance charts out while the portfolio holds no positions", async () => {
    const { client, call } = clientWith({
      getPortfolioOverview: () => Promise.resolve(overviewOf(0, [])),
    });
    renderPage(client);
    await screen.findAllByRole("button", { name: "New transaction" });

    expect(screen.queryByRole("heading", { name: "Performance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Daily performance" })).not.toBeInTheDocument();
    expect(call.mock.calls.some(([op]) => op.operationId === "getPortfolioPerformance")).toBe(
      false,
    );
  });

  it("keeps the rest of the dashboard when the performance fails, and retries only that panel", async () => {
    const getPortfolioPerformance = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503));
    renderPage(clientWith({ getPortfolioPerformance }).client);

    expect(await screen.findAllByText("Couldn't load the performance")).toHaveLength(1);
    expect(screen.queryByText("Couldn't load the dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("$125,430.25")).toBeInTheDocument();
  });

  it("asks for a portfolio when the user has none", async () => {
    renderPage(clientWith({ listPortfolios: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("You have no portfolios yet")).toBeInTheDocument();
  });

  it("leaves the day line out on a phone, as the Figma does", async () => {
    stubMobile(true);
    const { client, call } = clientWith();
    renderPage(client);
    await waitFor(() => {
      expect(call).toHaveBeenCalledWith(
        expect.objectContaining({ operationId: "getPortfolioOverview" }),
        expect.anything(),
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("status", { name: "Loading the dashboard" }),
      ).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/· Growth · 5 positions$/)).not.toBeInTheDocument();
  });
});
