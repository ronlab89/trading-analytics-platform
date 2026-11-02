import { render, screen, waitFor } from "@testing-library/react";
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
}

/** The part of the overview the page reads so far: the positions, the summary and today's change. */
const overviewOf = (positions: number) => ({
  data: {
    positions: Array.from({ length: positions }, (_, index) => ({ id: index })),
    summary: { totalValue: { amount: "125430.25", currency: "USD" } },
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

  it("offers a first transaction while the portfolio holds no positions", async () => {
    renderPage(clientWith({ getPortfolioOverview: () => Promise.resolve(overviewOf(0)) }).client);

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
