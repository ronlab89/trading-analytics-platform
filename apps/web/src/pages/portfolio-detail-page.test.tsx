import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { PortfolioDetailPage } from "@/pages/portfolio-detail-page";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";

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

function position(id: string, assetId: string) {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity: 10,
    averageEntryPrice: { amount: "100.00", currency: "USD" },
    currentPrice: { amount: "110.00", currency: "USD" },
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

type Answers = Partial<Record<"getPortfolio" | "listPositions", () => Promise<unknown>>>;

function clientWith(answers: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      const answer = answers[operation.operationId as keyof Answers];
      return answer ? answer() : Promise.reject(new Error(`unexpected ${operation.operationId}`));
    },
  );
  return { client: { call } as TradingClient, call };
}

function renderPage(client: TradingClient, path = "/portfolios/p1") {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<PortfolioDetailPage />} path="/portfolios/:portfolioId" />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
}

const loaded: Answers = {
  getPortfolio: () => Promise.resolve({ data: growth }),
  listPositions: () => Promise.resolve({ data: [position("s1", "a1"), position("s2", "a2")] }),
};

describe("PortfolioDetailPage", () => {
  it("names the portfolio in the page heading and links back to the list", async () => {
    renderPage(clientWith(loaded).client);

    expect(await screen.findByRole("heading", { level: 1, name: "Growth" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Portfolios" })).toHaveAttribute(
      "href",
      "/portfolios",
    );
  });

  it("states how many positions the portfolio holds", async () => {
    renderPage(clientWith(loaded).client);

    expect(await screen.findByText("2 positions")).toBeInTheDocument();
  });

  it("announces the positions as loading until they arrive", async () => {
    renderPage(clientWith({ ...loaded, listPositions: () => new Promise(() => undefined) }).client);

    expect(await screen.findByRole("status", { name: "Loading positions" })).toBeInTheDocument();
  });

  it("explains an empty portfolio without a transaction button that would do nothing yet", async () => {
    renderPage(
      clientWith({ ...loaded, listPositions: () => Promise.resolve({ data: [] }) }).client,
    );

    expect(await screen.findByText("No positions")).toBeInTheDocument();
    expect(
      screen.getByText("Record a buy transaction to add the first position of this portfolio."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New transaction" })).not.toBeInTheDocument();
  });

  it("shows a failed positions request inside the section and retries it on demand", async () => {
    let fail = true;
    const { client, call } = clientWith({
      ...loaded,
      listPositions: () =>
        fail
          ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
          : Promise.resolve({ data: [position("s1", "a1")] }),
    });
    renderPage(client);

    expect(await screen.findByText("Couldn't load the positions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Growth" })).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("1 position")).toBeInTheDocument();
    expect(
      call.mock.calls.filter(([operation]) => operation.operationId === "listPositions"),
    ).toHaveLength(2);
  });

  it("shows the not-found page when the portfolio does not exist", async () => {
    renderPage(
      clientWith({
        ...loaded,
        getPortfolio: () => Promise.reject(new ApiError("NOT_FOUND", "Not found", 404)),
      }).client,
    );

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("tells a failed portfolio request apart from a missing portfolio", async () => {
    renderPage(
      clientWith({
        ...loaded,
        getPortfolio: () => Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503)),
      }).client,
    );

    expect(await screen.findByText("Couldn't load the portfolio")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations once loaded", async () => {
    const { container } = renderPage(clientWith(loaded).client);
    await screen.findByText("2 positions");

    expect(await axe(container)).toHaveNoViolations();
  });
});
