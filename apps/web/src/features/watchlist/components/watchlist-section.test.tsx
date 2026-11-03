import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { WatchlistSection } from "./watchlist-section";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const item = (assetId: string) => ({
  id: `w-${assetId}`,
  userId: "u1",
  assetId,
  createdAt: "2026-11-01T10:00:00.000Z",
});

const assets: Record<string, { symbol: string; name: string }> = {
  a1: { symbol: "AAPL", name: "Apple Inc." },
  a2: { symbol: "KO", name: "Coca-Cola" },
};

const asset = (id: string) => ({
  id,
  ...assets[id],
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
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

interface Answers {
  watchlist?: () => Promise<unknown>;
  remove?: () => Promise<unknown>;
  add?: () => Promise<unknown>;
}

function clientWith({ watchlist, remove, add }: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) => {
      switch (operation.operationId) {
        case "listWatchlist":
          return watchlist?.() ?? Promise.resolve({ data: [item("a1"), item("a2")] });
        case "getAsset":
          return Promise.resolve({ data: asset(String(input?.params?.assetId)) });
        case "removeFromWatchlist":
          return remove?.() ?? Promise.resolve(undefined);
        case "addToWatchlist":
          return add?.() ?? Promise.resolve({ data: item("a1") });
        default:
          return Promise.resolve({ data: [price("a1"), price("a2")] });
      }
    },
  );
  return { client: { call } as TradingClient, call };
}

function renderSection(answers?: Answers) {
  const { client, call } = clientWith(answers);
  render(<WatchlistSection />, { wrapper: tradingClientWrapper(client) });
  return call;
}

const operationsCalled = (call: ReturnType<typeof clientWith>["call"]) =>
  call.mock.calls.map(([operation]) => operation.operationId);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WatchlistSection", () => {
  it("shows a loading status until the rows are ready", () => {
    renderSection({ watchlist: () => new Promise(() => undefined) });

    expect(screen.getByRole("status", { name: "Loading your watchlist" })).toBeVisible();
  });

  it("draws the watchlist once it loads", async () => {
    renderSection();

    expect(await screen.findByText("Apple Inc.")).toBeVisible();
    expect(screen.getByText("Coca-Cola")).toBeVisible();
  });

  it("explains an empty watchlist", async () => {
    renderSection({ watchlist: () => Promise.resolve({ data: [] }) });

    expect(await screen.findByText("Your watchlist is empty")).toBeVisible();
    expect(
      screen.getByText("Add assets from the catalog to follow their price and change."),
    ).toBeVisible();
  });

  it("offers a retry when the watchlist cannot load, and loads it again", async () => {
    const user = userEvent.setup();
    const watchlist = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "Server error"))
      .mockResolvedValue({ data: [item("a1")] });
    renderSection({ watchlist });

    expect(await screen.findByText("Could not load your watchlist")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Apple Inc.")).toBeVisible();
  });

  it("removes the asset and offers to undo it in a toast", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Coca-Cola");

    await user.click(screen.getByRole("button", { name: "Remove KO from the watchlist" }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        "KO removed from your watchlist",
        expect.objectContaining({
          description: "You can add it back from All assets.",
          action: expect.objectContaining({ label: "Undo" }) as unknown,
        }),
      );
    });
    expect(operationsCalled(call)).toContain("removeFromWatchlist");
  });

  it("adds the asset back when the toast's undo is pressed", async () => {
    const user = userEvent.setup();
    const call = renderSection();
    await screen.findByText("Coca-Cola");
    await user.click(screen.getByRole("button", { name: "Remove KO from the watchlist" }));
    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
    });

    const { action } = vi.mocked(toast).mock.calls[0]?.[1] as unknown as {
      action: { onClick: () => void };
    };
    action.onClick();

    await waitFor(() => {
      expect(operationsCalled(call)).toContain("addToWatchlist");
    });
    const [, input] = call.mock.calls.find(([op]) => op.operationId === "addToWatchlist") ?? [];
    expect(input?.body).toEqual({ assetId: "a2" });
  });

  it("tells the user when the removal is refused", async () => {
    const user = userEvent.setup();
    renderSection({ remove: () => Promise.reject(new ApiError("NOT_FOUND", "Not on the list")) });
    await screen.findByText("Coca-Cola");

    await user.click(screen.getByRole("button", { name: "Remove KO from the watchlist" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not remove KO from your watchlist");
    });
    expect(toast).not.toHaveBeenCalled();
  });
});
