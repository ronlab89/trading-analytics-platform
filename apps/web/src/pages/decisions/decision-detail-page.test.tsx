import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DecisionDetailPage } from "./decision-detail-page";

const usd = (amount: string) => ({ amount, currency: "USD" });

const replay = {
  decision: {
    id: "d1",
    portfolioId: "p1",
    assetId: "a1",
    title: "Buy AAPL before earnings",
    thesis: "Services keep growing.",
    direction: "LONG",
    entryPrice: usd("162.40"),
    targetPrice: usd("190.00"),
    stopPrice: usd("158.00"),
    riskLevel: "MODERATE",
    createdAt: "2026-08-12T10:05:00.000Z",
    closedAt: null,
    outcome: null,
    notes: "Review the stop.",
  },
  events: [
    {
      id: "e1",
      decisionId: "d1",
      timestamp: "2026-08-12T10:05:00.000Z",
      type: "DECISION_CREATED",
      payload: {},
    },
    {
      id: "e2",
      decisionId: "d1",
      timestamp: "2026-08-14T15:40:00.000Z",
      type: "POSITION_OPENED",
      payload: { quantity: "236", price: "162.40" },
    },
  ],
  currency: "USD",
  initialState: {},
};

interface Answers {
  replay?: () => Promise<unknown>;
  asset?: () => Promise<unknown>;
}

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "getDecisionReplay":
          return answers.replay?.() ?? Promise.resolve({ data: replay });
        case "getAsset":
          return (
            answers.asset?.() ??
            Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } })
          );
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
      <MemoryRouter initialEntries={["/decisions/d1"]}>
        <Routes>
          <Route element={<DecisionDetailPage />} path="/decisions/:decisionId" />
          <Route element={<p>The list</p>} path="/decisions" />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
}

describe("DecisionDetailPage", () => {
  it("names the page by the decision and asks for it by its id", async () => {
    const { client, call } = clientWith();
    renderPage(client);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Buy AAPL before earnings" }),
    ).toBeInTheDocument();
    const asked = call.mock.calls.find(
      ([operation]) => operation.operationId === "getDecisionReplay",
    );
    expect(asked?.[1]).toEqual({ params: { decisionId: "d1" } });
  });

  it("draws the way back, the indicators, the thesis and the events", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByRole("link", { name: "Back to decisions" })).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Entry" })).getByText("$162.40"),
    ).toBeVisible();
    expect(screen.getByText("Services keep growing.")).toBeVisible();
    expect(screen.getByText("Position opened")).toBeVisible();
    expect(screen.getByText("236 units at $162.40")).toBeVisible();
    expect(screen.getByText("Long")).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
  });

  it("holds the place of the page while the decision loads", () => {
    renderPage(clientWith({ replay: () => new Promise(() => undefined) }).client);

    expect(screen.getByRole("status", { name: "Loading the decision" })).toBeVisible();
  });

  it("still draws the page when the asset cannot be loaded", async () => {
    renderPage(
      clientWith({
        asset: () => Promise.reject(new ApiError("NOT_FOUND", "No such asset", 404)),
      }).client,
    );

    expect(await screen.findByText("Services keep growing.")).toBeVisible();
  });

  it("shows the not-found page for a decision that does not exist", async () => {
    renderPage(
      clientWith({
        replay: () => Promise.reject(new ApiError("NOT_FOUND", "No such decision", 404)),
      }).client,
    );

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  it("offers a retry when the decision cannot load, and asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPage(
      clientWith({
        replay: () =>
          fail
            ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error", 500))
            : Promise.resolve({ data: replay }),
      }).client,
    );

    expect(await screen.findByText("Could not load the decision")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to decisions" })).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Services keep growing.")).toBeVisible();
  });
});

describe("DecisionDetailPage on a phone", () => {
  afterEach(() => {
    vi.stubGlobal("matchMedia", undefined);
  });

  it("shows the title of the decision", async () => {
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
      await screen.findByRole("heading", { level: 1, name: "Buy AAPL before earnings" }),
    ).toHaveClass("text-2xl");
  });
});
