import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { CallInput, TradingClient } from "@/api/trading-client";
import { RealtimeClientProvider } from "@/realtime/realtime-client-provider";
import { createFakeRealtimeClient, type FakeRealtimeClient } from "@/test/fake-realtime-client";
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
        case "listAlerts":
          return Promise.resolve({
            data: [
              {
                id: "al1",
                userId: "u1",
                assetId: "a1",
                portfolioId: null,
                type: "PRICE",
                condition: "ABOVE",
                threshold: 200,
                enabled: true,
                createdAt: "2026-11-01T10:00:00.000Z",
                updatedAt: "2026-11-01T10:00:00.000Z",
              },
            ],
          });
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
  { catalogTotal, url = "/markets", realtime = createFakeRealtimeClient("connected") } = {} as {
    catalogTotal?: number;
    url?: string;
    realtime?: FakeRealtimeClient;
  },
) {
  const Wrapper = tradingClientWrapper(clientWith(assetIds, catalogTotal));
  return render(
    <RealtimeClientProvider client={realtime}>
      <MemoryRouter initialEntries={[url]}>
        <MarketsPage />
      </MemoryRouter>
    </RealtimeClientProvider>,
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

// Not `unstubAllGlobals`: that would also drop the ResizeObserver stub `setup.ts` installs once.
afterEach(() => {
  vi.stubGlobal("matchMedia", undefined);
});

describe("MarketsPage connection alert", () => {
  it("says nothing while the connection is up", async () => {
    mockViewport(false);
    renderPage(["a1"]);

    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
    expect(screen.queryByText("Offline: prices are paused")).not.toBeInTheDocument();
  });

  it.each(["", "?tab=all"])("warns that prices are paused on both tabs (%s)", async (query) => {
    mockViewport(false);
    renderPage(["a1"], {
      url: `/markets${query}`,
      realtime: createFakeRealtimeClient("reconnecting"),
    });

    expect(await screen.findByText("Offline: prices are paused")).toBeVisible();
  });

  it("offers a retry when the connection failed, and on a phone too", async () => {
    const user = userEvent.setup();
    mockViewport(true);
    const realtime = createFakeRealtimeClient("failed");
    renderPage(["a1"], { realtime });

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(realtime.calls.retry).toBe(1);
  });
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

  it("opens the alerts from the address and counts the price alerts in the header line", async () => {
    mockViewport(false);
    renderPage(["a1"], { url: "/markets?tab=alerts" });

    expect(await screen.findByText("1 alert · price alerts")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Alerts", selected: true })).toBeVisible();
    expect(screen.queryByText(/on your watchlist/)).not.toBeInTheDocument();
  });

  it("changes to the alerts tab and back", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    renderPage(["a1"]);
    await screen.findByText("1 asset on your watchlist · simulated prices");

    await user.click(screen.getByRole("tab", { name: "Alerts" }));

    expect(await screen.findByText("1 alert · price alerts")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Watchlist" }));
    expect(await screen.findByText("1 asset on your watchlist · simulated prices")).toBeVisible();
  });

  it("opens the create alert dialog from the alerts tab", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    renderPage(["a1"], { url: "/markets?tab=alerts" });

    await user.click(await screen.findByRole("button", { name: "Create alert" }));

    expect(await screen.findByRole("dialog", { name: "Create alert" })).toBeVisible();
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
