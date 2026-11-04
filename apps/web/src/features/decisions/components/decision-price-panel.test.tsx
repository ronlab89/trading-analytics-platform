import type { DecisionResponse, HistoricalPriceResponse } from "@trading/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DecisionPricePanel } from "./decision-price-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const candle = (day: string, close: string): HistoricalPriceResponse => ({
  assetId: "a1",
  timestamp: `${day}T00:00:00.000Z`,
  open: usd(close),
  high: usd(close),
  low: usd(close),
  close: usd(close),
  volume: 100,
});

const decision = {
  assetId: "a1",
  entryPrice: usd("162.40"),
  targetPrice: usd("190.00"),
  stopPrice: null,
  createdAt: "2026-08-12T10:05:00.000Z",
  closedAt: "2026-08-14T10:05:00.000Z",
} as DecisionResponse;

const renderPanel = (call: () => Promise<unknown>) =>
  render(
    <DecisionPricePanel
      currency="USD"
      currentTimestamp="2026-08-13T15:00:00.000Z"
      decision={decision}
      symbol="AAPL"
    />,
    { wrapper: tradingClientWrapper({ call }) },
  );

describe("DecisionPricePanel", () => {
  it("names the asset and the period and says where the price stands at the current event", async () => {
    renderPanel(() =>
      Promise.resolve({
        data: [
          candle("2026-08-12", "160"),
          candle("2026-08-13", "165"),
          candle("2026-08-14", "170"),
        ],
      }),
    );

    expect(screen.getByRole("heading", { name: "AAPL price" })).toBeVisible();
    expect(
      await screen.findByText("On Aug 13 the price was $165.00. Target $190.00. Entry $162.40."),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "AAPL price" })).toBeVisible();
    expect(screen.getByText(/· USD · what has not happened yet is dimmed$/)).toBeVisible();
  });

  it("names in the legend only the lines the decision has", async () => {
    renderPanel(() =>
      Promise.resolve({ data: [candle("2026-08-12", "160"), candle("2026-08-13", "165")] }),
    );

    await screen.findByRole("img", { name: "AAPL price" });
    expect(screen.getByText("Price")).toBeVisible();
    expect(screen.getByText("Entry")).toBeVisible();
    expect(screen.getByText("Target")).toBeVisible();
    expect(screen.queryByText("Stop")).not.toBeInTheDocument();
  });

  it("says there is no history when there are too few days to draw a line", async () => {
    renderPanel(() => Promise.resolve({ data: [candle("2026-08-12", "160")] }));

    expect(await screen.findByText("No price history for this period.")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("offers a retry that asks again when it fails", async () => {
    const call = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ data: [candle("2026-08-12", "160"), candle("2026-08-13", "165")] });
    renderPanel(call);

    expect(await screen.findByText("Could not load the price history")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "AAPL price" })).toBeVisible();
    });
  });

  it("says loading while the candles are on their way", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the price history" })).toBeVisible();
  });
});
