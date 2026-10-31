import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { PortfolioDetailPage } from "@/pages/portfolios/portfolio-detail-page";
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

function position(
  id: string,
  assetId: string,
  { quantity = 10, average = "100.00", current = "110.00" } = {},
) {
  return {
    id,
    portfolioId: "p1",
    assetId,
    quantity,
    averageEntryPrice: { amount: average, currency: "USD" },
    currentPrice: { amount: current, currency: "USD" },
    openedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

function asset(id: string, symbol: string, name: string) {
  return {
    id,
    symbol,
    name,
    assetType: "STOCK",
    currency: "USD",
    exchange: "NASDAQ",
    status: "ACTIVE",
    metadata: {},
  };
}

const assets = new Map([
  ["a1", asset("a1", "AAPL", "Apple Inc.")],
  ["a2", asset("a2", "MSFT", "Microsoft")],
]);

interface Answers {
  getPortfolio?: () => Promise<unknown>;
  listPositions?: () => Promise<unknown>;
  getAsset?: (assetId: string) => Promise<unknown>;
}

function clientWith(answers: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      const unexpected = () => Promise.reject(new Error(`unexpected ${operation.operationId}`));
      if (operation.operationId === "getAsset") {
        return answers.getAsset?.(input?.params?.assetId ?? "") ?? unexpected();
      }
      const answer = answers[operation.operationId as "getPortfolio" | "listPositions"];
      return answer ? answer() : unexpected();
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
  getAsset: (assetId) => Promise.resolve({ data: assets.get(assetId) }),
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

  it("lists each position with its asset, quantity and prices", async () => {
    renderPage(
      clientWith({
        ...loaded,
        listPositions: () =>
          Promise.resolve({
            data: [position("s1", "a1", { quantity: 17560, average: "162.4", current: "180.70" })],
          }),
      }).client,
    );

    const table = await screen.findByRole("table", { name: "Positions" });
    const row = within(table).getByRole("row", { name: /Apple Inc\./ });
    expect(within(row).getByText("AAPL")).toBeInTheDocument();
    expect(within(row).getByText("17,560")).toBeInTheDocument();
    expect(within(row).getByText("$162.40")).toBeInTheDocument();
    expect(within(row).getByText("$180.70")).toBeInTheDocument();
  });

  it("marks the position of an asset that could not be loaded instead of hiding it", async () => {
    renderPage(
      clientWith({
        ...loaded,
        getAsset: (assetId) =>
          assetId === "a1"
            ? Promise.resolve({ data: assets.get("a1") })
            : Promise.reject(new ApiError("NOT_FOUND", "Asset not found", 404)),
      }).client,
    );

    const table = await screen.findByRole("table", { name: "Positions" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Unknown asset")).toBeInTheDocument();
  });

  it("sorts the price columns by their value, not by their text", async () => {
    renderPage(
      clientWith({
        ...loaded,
        listPositions: () =>
          Promise.resolve({
            data: [
              position("s1", "a1", { average: "100.00" }),
              position("s2", "a2", { average: "9.00" }),
            ],
          }),
      }).client,
    );

    const table = await screen.findByRole("table", { name: "Positions" });
    await userEvent.click(within(table).getByRole("button", { name: /Avg\. price/ }));

    const [first, second] = within(table).getAllByRole("row").slice(1);
    expect(first).toHaveTextContent("MSFT");
    expect(second).toHaveTextContent("AAPL");
  });

  it("shows the positions ten at a time", async () => {
    renderPage(
      clientWith({
        ...loaded,
        listPositions: () =>
          Promise.resolve({
            data: Array.from({ length: 12 }, (_, index) => position(`s${String(index)}`, "a1")),
          }),
      }).client,
    );

    const table = await screen.findByRole("table", { name: "Positions" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();
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

  it("offers the Edit button but not the ⋯ menu outside mobile, as the Figma does", async () => {
    const user = userEvent.setup();
    renderPage(clientWith(loaded).client);
    await screen.findByText("2 positions");

    expect(screen.queryByRole("button", { name: "Portfolio actions" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit portfolio" })).toBeInTheDocument();
  });

  describe("on mobile", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query === "(max-width: 560px)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows the Edit button next to the back link and opens the edit form from it", async () => {
      const user = userEvent.setup();
      renderPage(clientWith(loaded).client);

      await user.click(await screen.findByRole("button", { name: "Edit" }));

      expect(await screen.findByRole("dialog", { name: "Edit portfolio" })).toBeInTheDocument();
    });

    it("opens the edit form from the ⋯ menu", async () => {
      const user = userEvent.setup();
      renderPage(clientWith(loaded).client);

      await user.click(await screen.findByRole("button", { name: "Portfolio actions" }));
      await user.click(screen.getByRole("menuitem", { name: "Edit" }));

      expect(await screen.findByRole("dialog", { name: "Edit portfolio" })).toBeInTheDocument();
    });

    it("asks before archiving from the ⋯ menu, which has no delete", async () => {
      const user = userEvent.setup();
      renderPage(clientWith(loaded).client);

      await user.click(await screen.findByRole("button", { name: "Portfolio actions" }));
      expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("menuitem", { name: "Archive" }));

      expect(await screen.findByRole("dialog", { name: "Archive portfolio?" })).toBeInTheDocument();
    });

    it("offers no actions for an archived portfolio, which the API refuses to change", async () => {
      renderPage(
        clientWith({
          ...loaded,
          getPortfolio: () => Promise.resolve({ data: { ...growth, status: "ARCHIVED" } }),
        }).client,
      );
      await screen.findByRole("list", { name: "Positions" });

      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Portfolio actions" })).not.toBeInTheDocument();
    });

    it("shows each position as a card with its quantity and prices instead of a table", async () => {
      renderPage(
        clientWith({
          ...loaded,
          listPositions: () =>
            Promise.resolve({
              data: [position("s1", "a1", { quantity: 236, average: "162.4", current: "180.70" })],
            }),
        }).client,
      );

      const list = await screen.findByRole("list", { name: "Positions" });
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      const card = within(list).getByRole("listitem");
      expect(within(card).getByText("AAPL")).toBeInTheDocument();
      expect(within(card).getByText("Apple Inc.")).toBeInTheDocument();
      expect(
        within(card).getByText("236 units · Avg. $162.40 · Current $180.70"),
      ).toBeInTheDocument();
      expect(screen.queryByText("1 position")).not.toBeInTheDocument();
    });

    it("shows the loading cards while the positions arrive", () => {
      renderPage(
        clientWith({ ...loaded, listPositions: () => new Promise(() => undefined) }).client,
      );

      expect(screen.getByRole("status", { name: "Loading positions" })).toBeInTheDocument();
    });

    it("explains an empty portfolio as on desktop", async () => {
      renderPage(
        clientWith({ ...loaded, listPositions: () => Promise.resolve({ data: [] }) }).client,
      );

      expect(await screen.findByText("No positions")).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      const { container } = renderPage(clientWith(loaded).client);
      await screen.findByRole("list", { name: "Positions" });

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
