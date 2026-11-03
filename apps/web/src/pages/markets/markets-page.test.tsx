import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { MarketsPage } from "./markets-page";

const item = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

const asset = (id: string) => ({
  id,
  symbol: id.toUpperCase(),
  name: id,
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

function clientWith(assetIds: string[], catalogTotal = 24) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listWatchlist":
          return Promise.resolve({ data: assetIds.map(item) });
        case "getAsset":
          return Promise.resolve({ data: asset(String(input?.params?.assetId)) });
        case "listAssets":
          return Promise.resolve({
            data: [asset("a1")],
            meta: { page: 1, pageSize: 1, total: catalogTotal, totalPages: catalogTotal },
          });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  return { call } as TradingClient;
}

function renderPage(
  assetIds: string[],
  { catalogTotal, url = "/markets" } = {} as {
    catalogTotal?: number;
    url?: string;
  },
) {
  const Wrapper = tradingClientWrapper(clientWith(assetIds, catalogTotal));
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MarketsPage />
    </MemoryRouter>,
    { wrapper: Wrapper },
  );
}

function mockViewport(mobile: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MarketsPage", () => {
  it("opens on the watchlist and counts the watched assets in the header line", async () => {
    mockViewport(false);
    renderPage(["a1", "a2"]);

    expect(await screen.findByText("2 assets on your watchlist · simulated prices")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Watchlist", selected: true })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Markets" })).toBeInTheDocument();
  });

  it("uses the singular for a single watched asset", async () => {
    mockViewport(false);
    renderPage(["a1"]);

    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
  });

  it("opens the catalog from the address and counts every asset in the header line", async () => {
    mockViewport(false);
    renderPage(["a1"], { url: "/markets?tab=all" });

    expect(await screen.findByText("24 assets available · simulated prices")).toBeVisible();
    expect(screen.getByRole("tab", { name: "All assets", selected: true })).toBeVisible();
    expect(screen.queryByText(/on your watchlist/)).not.toBeInTheDocument();
  });

  it("changes between the tabs", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    renderPage(["a1"]);
    await screen.findByText("1 asset on your watchlist · simulated prices");

    await user.click(screen.getByRole("tab", { name: "All assets" }));

    expect(await screen.findByText("24 assets available · simulated prices")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Watchlist" }));
    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
  });

  it("falls back to the watchlist for an unknown tab in the address", async () => {
    mockViewport(false);
    renderPage(["a1"], { url: "/markets?tab=other" });

    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
  });

  it("shows the title with the tabs under it, and no header line, on a phone", () => {
    mockViewport(true);
    renderPage(["a1"]);

    expect(screen.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "All assets" })).toBeVisible();
    expect(screen.queryByText(/on your watchlist/)).not.toBeInTheDocument();
  });
});
