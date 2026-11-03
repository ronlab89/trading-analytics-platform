import { render, screen } from "@testing-library/react";
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

function clientWith(assetIds: string[]) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listWatchlist":
          return Promise.resolve({ data: assetIds.map(item) });
        case "getAsset":
          return Promise.resolve({ data: asset(String(input?.params?.assetId)) });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  return { call } as TradingClient;
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
  it("counts the watched assets in the header line on the desktop", async () => {
    mockViewport(false);
    render(<MarketsPage />, { wrapper: tradingClientWrapper(clientWith(["a1", "a2"])) });

    expect(await screen.findByText("2 assets on your watchlist · simulated prices")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Markets" })).toBeInTheDocument();
  });

  it("uses the singular for a single watched asset", async () => {
    mockViewport(false);
    render(<MarketsPage />, { wrapper: tradingClientWrapper(clientWith(["a1"])) });

    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
  });

  it("shows the title instead of the header line on a phone", () => {
    mockViewport(true);
    render(<MarketsPage />, { wrapper: tradingClientWrapper(clientWith(["a1"])) });

    expect(screen.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();
    expect(screen.queryByText(/on your watchlist/)).not.toBeInTheDocument();
  });
});
