import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DecisionsPage } from "./decisions-page";

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

const decision = (id: string, title: string, closedAt: string | null = null) => ({
  id,
  portfolioId: "p1",
  assetId: "a1",
  title,
  thesis: "A thesis.",
  direction: "LONG",
  entryPrice: { amount: "150.00", currency: "USD" },
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  createdAt: "2026-06-01T14:00:00.000Z",
  closedAt,
  outcome: null,
  notes: null,
});

const decisions = [
  decision("d1", "Buy the dip"),
  decision("d2", "Cut the loss", "2026-06-20T14:00:00.000Z"),
  decision("d3", "Wait and see"),
];

interface Answers {
  listPortfolios?: () => Promise<unknown>;
  listDecisions?: () => Promise<unknown>;
}

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "listPortfolios":
          return answers.listPortfolios?.() ?? Promise.resolve({ data: [growth] });
        case "listDecisions":
          return answers.listDecisions?.() ?? Promise.resolve({ data: decisions });
        case "getAsset":
          return Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } });
        default:
          return Promise.resolve({ data: [] });
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
        <DecisionsPage />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
});

describe("DecisionsPage", () => {
  it("names the page for screen readers", () => {
    renderPage(clientWith().client);

    expect(screen.getByRole("heading", { level: 1, name: "Decision Center" })).toBeInTheDocument();
  });

  it("lists the decisions of the active portfolio and counts them, open ones apart", async () => {
    const { client, call } = clientWith();
    renderPage(client);

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
    expect(screen.getByRole("row", { name: /Cut the loss/ })).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Buy the dip/ })).getByText("AAPL"),
    ).toBeVisible();
    const listed = call.mock.calls.find(([operation]) => operation.operationId === "listDecisions");
    expect(listed?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("holds the place of the table while the decisions load", async () => {
    renderPage(clientWith({ listDecisions: () => new Promise(() => undefined) }).client);

    expect(await screen.findByRole("status", { name: "Loading the decisions" })).toBeVisible();
  });

  it("offers a first transaction when the portfolio has no decisions", async () => {
    const user = userEvent.setup();
    renderPage(clientWith({ listDecisions: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("No decisions yet")).toBeVisible();
    expect(screen.queryByText(/decisions recorded/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New transaction" }));

    expect(await screen.findByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
  });

  it("offers a retry when the decisions cannot load, and asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPage(
      clientWith({
        listDecisions: () =>
          fail
            ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
            : Promise.resolve({ data: decisions }),
      }).client,
    );

    expect(await screen.findByText("Could not load the decisions")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
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

    expect(await screen.findByText("Could not load the decisions")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("DecisionsPage on a phone", () => {
  afterEach(() => {
    vi.stubGlobal("matchMedia", undefined);
  });

  it("shows the title and the decisions as cards", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderPage(clientWith().client);

    expect(
      await within(await screen.findByRole("list", { name: "Decisions" })).findAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 1, name: "Decision Center" })).toHaveClass(
      "text-2xl",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
