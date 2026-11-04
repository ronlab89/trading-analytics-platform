import type { DecisionResponse, HistoricalPriceResponse } from "@trading/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DecisionExpectedPanel } from "./decision-expected-panel";

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
  direction: "LONG",
  entryPrice: usd("162.40"),
  targetPrice: usd("190.00"),
  stopPrice: null,
  riskLevel: "MODERATE",
  createdAt: "2026-08-12T10:05:00.000Z",
  closedAt: "2026-09-20T09:00:00.000Z",
} as DecisionResponse;

const candles = [
  candle("2026-08-14", "162.40"),
  candle("2026-08-19", "160.10"),
  candle("2026-08-28", "173.50"),
];

interface Overrides {
  decision?: DecisionResponse;
  currentTimestamp?: string | null;
  openedAt?: string | null;
}

const renderPanel = (call: () => Promise<unknown>, overrides: Overrides = {}) =>
  render(
    <DecisionExpectedPanel
      currency="USD"
      currentTimestamp={
        overrides.currentTimestamp === undefined
          ? "2026-08-28T09:30:00.000Z"
          : overrides.currentTimestamp
      }
      decision={overrides.decision ?? decision}
      openedAt={overrides.openedAt === undefined ? "2026-08-14T15:40:00.000Z" : overrides.openedAt}
    />,
    { wrapper: tradingClientWrapper({ call }) },
  );

const row = (name: RegExp) => screen.getByRole("row", { name });

describe("DecisionExpectedPanel", () => {
  it("sets what the decision expected beside what the price has done up to the current event", async () => {
    renderPanel(() => Promise.resolve({ data: candles }));

    expect(screen.getByRole("heading", { name: "Expected vs actual" })).toBeVisible();
    await screen.findByRole("table");
    expect(screen.getByText("Up to Aug 28")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Expected" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Actual" })).toBeVisible();
    expect(row(/^Direction/)).toHaveTextContent("LongRising");
    expect(row(/^Target/)).toHaveTextContent("$190.00$173.50 · 40%");
    expect(row(/^Risk/)).toHaveTextContent("MediumMax. drop -1.42%");
    expect(row(/^Result/)).toHaveTextContent("+17.00%+6.83%");
  });

  it("says the price never fell when it did not go under the entry", async () => {
    renderPanel(() => Promise.resolve({ data: candles }), {
      currentTimestamp: "2026-08-14T15:40:00.000Z",
    });

    expect(await screen.findByText("No drop")).toBeVisible();
    expect(row(/^Direction/)).toHaveTextContent("LongUnchanged");
  });

  it("leaves the real column as dashes before the position opens", async () => {
    renderPanel(() => Promise.resolve({ data: candles }), {
      currentTimestamp: "2026-08-12T10:05:00.000Z",
    });

    await screen.findByRole("table");
    expect(screen.getByText("Up to Aug 12")).toBeVisible();
    expect(row(/^Direction/)).toHaveTextContent("Long—");
    expect(row(/^Target/)).toHaveTextContent("$190.00—");
    expect(row(/^Risk/)).toHaveTextContent("Medium—");
    expect(row(/^Result/)).toHaveTextContent("+17.00%—");
  });

  it("shows a dash for a price the decision does not set", async () => {
    renderPanel(() => Promise.resolve({ data: candles }), {
      decision: { ...decision, targetPrice: null, riskLevel: null },
    });

    await screen.findByRole("table");
    expect(screen.getByText("Up to Aug 28")).toBeVisible();
    expect(row(/^Target/)).toHaveTextContent("—$173.50");
    expect(row(/^Risk/)).toHaveTextContent("—Max. drop");
    expect(row(/^Result/)).toHaveTextContent("—+6.83%");
  });

  it("reads a short by what it gained: the price falling is a gain", async () => {
    renderPanel(
      () => Promise.resolve({ data: [candle("2026-08-14", "100"), candle("2026-08-28", "95")] }),
      {
        decision: {
          ...decision,
          direction: "SHORT",
          entryPrice: usd("100.00"),
          targetPrice: usd("90.00"),
        },
      },
    );

    await screen.findByRole("table");
    expect(screen.getByText("Up to Aug 28")).toBeVisible();
    expect(row(/^Direction/)).toHaveTextContent("ShortFalling");
    expect(row(/^Target/)).toHaveTextContent("$90.00$95.00 · 50%");
    expect(row(/^Result/)).toHaveTextContent("+10.00%+5.00%");
  });

  it("says it is loading while the candles are on their way", () => {
    renderPanel(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading the comparison" })).toBeVisible();
  });

  it("keeps the expected column and says why the real one is empty when the history fails", async () => {
    renderPanel(() => Promise.reject(new Error("offline")));

    expect(
      await screen.findByText(
        "The real figures need the price history, which could not be loaded.",
      ),
    ).toBeVisible();
    expect(row(/^Target/)).toHaveTextContent("$190.00—");
    expect(row(/^Result/)).toHaveTextContent("+17.00%—");
  });

  it("is not drawn when there is no event to stand on", () => {
    renderPanel(() => Promise.resolve({ data: candles }), { currentTimestamp: null });

    expect(screen.queryByRole("heading", { name: "Expected vs actual" })).not.toBeInTheDocument();
  });
});
