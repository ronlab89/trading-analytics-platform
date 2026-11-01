import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AssetResponse, TransactionResponse } from "@trading/contracts";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { TransactionsPage } from "./transactions-page";

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

function transaction(
  id: string,
  assetId: string,
  type: "BUY" | "SELL" = "BUY",
): TransactionResponse {
  return {
    id,
    portfolioId: "p1",
    assetId,
    type,
    quantity: 10,
    price: { amount: "180.20", currency: "USD" },
    fees: { amount: "1.00", currency: "USD" },
    realizedPnL: null,
    status: "COMPLETED",
    executedAt: "2026-10-06T14:29:00.000Z",
    createdAt: "2026-10-06T14:29:00.000Z",
  };
}

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

interface Answers {
  listPortfolios?: () => Promise<unknown>;
  listTransactions?: (input?: CallInput) => Promise<unknown>;
}

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listPortfolios":
          return answers.listPortfolios?.() ?? Promise.resolve({ data: [growth] });
        case "listTransactions":
          return (
            answers.listTransactions?.(input) ??
            Promise.resolve({
              data: [transaction("t1", "a1"), transaction("t2", "a1", "SELL")],
              meta: { page: 1, pageSize: 10, total: 48, totalPages: 5 },
            })
          );
        case "getAsset":
          return Promise.resolve({ data: apple });
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
        <TransactionsPage />
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
  stubMobile(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TransactionsPage", () => {
  it("names the page and says whose history it is and how many transactions it holds", async () => {
    renderPage(clientWith().client);

    expect(screen.getByRole("heading", { level: 1, name: "Transactions" })).toBeInTheDocument();
    expect(await screen.findByText("History of Growth · 48 transactions")).toBeInTheDocument();
  });

  it("lists the transactions of the active portfolio in a table", async () => {
    renderPage(clientWith().client);

    const table = await screen.findByRole("table", { name: "Transactions" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByText("Apple Inc.")).toHaveLength(2);
    expect(screen.getByText("Showing 1–2 of 48")).toBeInTheDocument();
  });

  it("asks the server for the next page", async () => {
    const { client, call } = clientWith();
    renderPage(client);
    await screen.findByRole("table", { name: "Transactions" });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "listTransactions" }),
      expect.objectContaining({ query: { page: 2, pageSize: 10 } }),
    );
  });

  it("goes back to the first page when the rows per page change", async () => {
    const { client, call } = clientWith();
    renderPage(client);
    await screen.findByRole("table", { name: "Transactions" });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await userEvent.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await userEvent.click(screen.getByRole("option", { name: "50" }));

    expect(call).toHaveBeenLastCalledWith(
      expect.objectContaining({ operationId: "listTransactions" }),
      expect.objectContaining({ query: { page: 1, pageSize: 50 } }),
    );
  });

  it("says there are no transactions yet", async () => {
    renderPage(
      clientWith({
        listTransactions: () =>
          Promise.resolve({ data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }),
      }).client,
    );

    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps the failure inside the page and retries", async () => {
    const listTransactions = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "Server error", 500))
      .mockResolvedValue({
        data: [transaction("t1", "a1")],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      });
    renderPage(clientWith({ listTransactions }).client);

    expect(await screen.findByText("Couldn't load the transactions")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("table", { name: "Transactions" })).toBeInTheDocument();
  });

  it("asks for a portfolio when there is none", async () => {
    renderPage(clientWith({ listPortfolios: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("You have no portfolios yet")).toBeInTheDocument();
  });

  it("draws the cards instead of the table on a phone, with no summary line", async () => {
    stubMobile(true);
    renderPage(clientWith().client);

    const list = await screen.findByRole("list", { name: "Transactions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/History of/)).not.toBeInTheDocument();
  });
});
