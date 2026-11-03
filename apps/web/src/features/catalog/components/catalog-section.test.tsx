import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { CatalogSection } from "./catalog-section";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const asset = (id: string, symbol: string, name: string, exchange = "NASDAQ") => ({
  id,
  symbol,
  name,
  assetType: "STOCK",
  currency: "USD",
  exchange,
  status: "ACTIVE",
  metadata: {},
});

const price = (assetId: string) => ({
  assetId,
  price: { amount: "180.70", currency: "USD" },
  previousPrice: { amount: "177.00", currency: "USD" },
  change: { amount: "3.70", currency: "USD" },
  changePercent: 2.1,
  timestamp: "2026-11-03T14:32:07.000Z",
  source: "SIMULATED",
});

const watchItem = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

const apple = asset("a1", "AAPL", "Apple Inc.");
const voo = asset("a2", "VOO", "Vanguard S&P 500", "NYSEARCA");
const meta = (page = 1, pageSize = 10) => ({ page, pageSize, total: 24, totalPages: 3 });

interface Answers {
  list?: (input?: CallInput) => Promise<unknown>;
  watchlist?: () => Promise<unknown>;
  add?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
}

function renderSection(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listAssets":
          return answers.list?.(input) ?? Promise.resolve({ data: [apple, voo], meta: meta() });
        case "listWatchlist":
          return answers.watchlist?.() ?? Promise.resolve({ data: [watchItem("a2")] });
        case "addToWatchlist":
          return answers.add?.() ?? Promise.resolve({ data: watchItem("a1") });
        case "removeFromWatchlist":
          return answers.remove?.() ?? Promise.resolve(undefined);
        default:
          return Promise.resolve({ data: [price("a1"), price("a2")] });
      }
    },
  );
  render(<CatalogSection />, { wrapper: tradingClientWrapper({ call }) });
  return call;
}

const callsOf = (call: ReturnType<typeof renderSection>, operationId: string) =>
  call.mock.calls.filter(([operation]) => operation.operationId === operationId);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CatalogSection", () => {
  it("draws each asset with its exchange, price and change, and the server's paging", async () => {
    renderSection();

    const row = (await screen.findByText("Vanguard S&P 500")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("NYSE Arca")).toBeVisible();
    expect(within(row as HTMLElement).getByText("$180.70")).toBeVisible();
    expect(within(row as HTMLElement).getByText("+2.10%")).toBeVisible();
    expect(screen.getByText("Showing 1–2 of 24")).toBeVisible();
  });

  it("does not sort by any column: the API gives the order", async () => {
    renderSection();
    await screen.findByText("Apple Inc.");

    expect(
      within(screen.getByRole("table")).queryByRole("button", { name: /Asset|Price|Type/ }),
    ).not.toBeInTheDocument();
  });

  it("marks the watched assets and offers to add the others", async () => {
    renderSection();
    await screen.findByText("Apple Inc.");

    expect(screen.getByRole("button", { name: "Add AAPL to the watchlist" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove VOO from the watchlist" })).toBeEnabled();
  });

  it("adds an asset to the watchlist when its star is pressed", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Apple Inc.");

    await user.click(screen.getByRole("button", { name: "Add AAPL to the watchlist" }));

    await waitFor(() => {
      expect(callsOf(call, "addToWatchlist")).toHaveLength(1);
    });
    expect(callsOf(call, "addToWatchlist")[0]?.[1]?.body).toEqual({ assetId: "a1" });
  });

  it("removes a watched asset, with the toast that can undo it", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Apple Inc.");

    await user.click(screen.getByRole("button", { name: "Remove VOO from the watchlist" }));

    await waitFor(() => {
      expect(callsOf(call, "removeFromWatchlist")).toHaveLength(1);
    });
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        "VOO removed from your watchlist",
        expect.objectContaining({ description: "You can add it back from All assets." }),
      );
    });
  });

  it("tells the user when the addition is refused", async () => {
    const user = userEvent.setup();
    renderSection({ add: () => Promise.reject(new ApiError("VALIDATION_ERROR", "Already added")) });
    await screen.findByText("Apple Inc.");

    await user.click(screen.getByRole("button", { name: "Add AAPL to the watchlist" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not add AAPL to your watchlist");
    });
  });

  it("keeps the catalog but disables the stars when the watchlist cannot load", async () => {
    renderSection({
      watchlist: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
    });

    expect(await screen.findByText("Apple Inc.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add AAPL to the watchlist" })).toBeDisabled();
  });

  it("searches the catalog once the typing pauses, with one request for the whole term", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Apple Inc.");

    await user.type(screen.getByRole("searchbox", { name: "Search by symbol or name" }), "qqq");

    await waitFor(() => {
      expect(callsOf(call, "listAssets").at(-1)?.[1]?.query).toMatchObject({
        search: "qqq",
        page: 1,
      });
    });
    const searches = callsOf(call, "listAssets").filter(
      ([, input]) => input?.query?.search !== undefined,
    );
    expect(searches).toHaveLength(1);
  });

  it("goes to the next page and starts again on the first when the page size changes", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Apple Inc.");

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => {
      expect(callsOf(call, "listAssets").at(-1)?.[1]?.query).toMatchObject({
        page: 2,
        pageSize: 10,
      });
    });

    await user.click(screen.getByRole("combobox", { name: /Rows per page/ }));
    await user.click(await screen.findByRole("option", { name: "20" }));
    await waitFor(() => {
      expect(callsOf(call, "listAssets").at(-1)?.[1]?.query).toMatchObject({
        page: 1,
        pageSize: 20,
      });
    });
  });
});
