import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AlertResponse } from "@trading/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput } from "@/api/trading-client";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { AlertsSection } from "./alerts-section";

function alert(id: string, assetId: string, overrides: Partial<AlertResponse> = {}): AlertResponse {
  return {
    id,
    userId: "u1",
    assetId,
    portfolioId: null,
    type: "PRICE",
    condition: "ABOVE",
    threshold: 200,
    enabled: true,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

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

function renderSection(
  listAlerts: () => Promise<unknown> = () =>
    Promise.resolve({
      data: [
        alert("al1", "a1"),
        alert("al2", "a2", {
          condition: "BELOW",
          threshold: 55,
          enabled: false,
          createdAt: "2026-10-01T10:00:00.000Z",
        }),
      ],
    }),
  props: Parameters<typeof AlertsSection>[0] = {},
) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation, input) =>
      operation.operationId === "listAlerts"
        ? listAlerts()
        : Promise.resolve({ data: asset(String(input?.params?.assetId)) }),
  );
  render(<AlertsSection {...props} />, {
    wrapper: tradingClientWrapper({ call }),
  });
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

describe("AlertsSection", () => {
  it("shows a loading status until the rows are ready", () => {
    mockViewport(false);
    renderSection(() => new Promise(() => undefined));

    expect(screen.getByRole("status", { name: "Loading your alerts" })).toBeVisible();
  });

  it("draws each alert with its asset, condition, threshold and status", async () => {
    mockViewport(false);
    renderSection();

    const table = await screen.findByRole("table", { name: "Alerts" });
    const [, apple, coke] = within(table).getAllByRole("row");
    expect(apple).toHaveTextContent("Apple Inc.");
    expect(apple).toHaveTextContent("Above");
    expect(apple).toHaveTextContent("$200.00");
    expect(apple).toHaveTextContent("Active");
    expect(coke).toHaveTextContent("Coca-Cola");
    expect(coke).toHaveTextContent("Below");
    expect(coke).toHaveTextContent("$55.00");
    expect(coke).toHaveTextContent("Paused");
  });

  it("marks the Updated column to drop below the desktop", async () => {
    mockViewport(false);
    renderSection();

    const table = await screen.findByRole("table", { name: "Alerts" });

    expect(within(table).getByRole("columnheader", { name: "Updated" })).toHaveClass(
      "max-desktop:hidden",
    );
    expect(within(table).getByRole("columnheader", { name: "Condition" })).not.toHaveClass(
      "max-desktop:hidden",
    );
  });

  it("lists the alerts as cards on a phone", async () => {
    mockViewport(true);
    renderSection();

    const list = await screen.findByRole("list", { name: "Alerts" });

    const [apple] = within(list).getAllByRole("listitem");
    expect(apple).toHaveTextContent("Apple Inc.");
    expect(apple).toHaveTextContent("Above $200.00");
    expect(apple).toHaveTextContent("Active");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains that there are no alerts, and offers to create one", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    mockViewport(false);
    renderSection(() => Promise.resolve({ data: [] }), { onCreate });

    expect(await screen.findByText("No alerts yet")).toBeVisible();
    expect(
      screen.getByText("Create a price alert to be told when an asset crosses a level."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create alert" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("does not offer to create while nobody can handle it", async () => {
    mockViewport(false);
    renderSection(() => Promise.resolve({ data: [] }));

    await screen.findByText("No alerts yet");

    expect(screen.queryByRole("button", { name: "Create alert" })).not.toBeInTheDocument();
  });

  it("has a Create alert button next to the search", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    mockViewport(false);
    renderSection(undefined, { onCreate });

    await screen.findByRole("table", { name: "Alerts" });
    await user.click(screen.getByRole("button", { name: "Create alert" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("searches by the name or the symbol of the asset", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    renderSection();
    await screen.findByRole("table", { name: "Alerts" });

    await user.type(screen.getByRole("searchbox", { name: "Search alerts" }), "ko");

    const table = screen.getByRole("table", { name: "Alerts" });
    expect(within(table).getByText("Coca-Cola")).toBeVisible();
    expect(within(table).queryByText("Apple Inc.")).not.toBeInTheDocument();
  });

  it("says nothing matches the search, and clears it", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    renderSection();
    await screen.findByRole("table", { name: "Alerts" });

    await user.type(screen.getByRole("searchbox", { name: "Search alerts" }), "zzz");

    expect(screen.getByText('No alert matches "zzz".')).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(await screen.findByText("Apple Inc.")).toBeVisible();
  });

  it("offers a retry when the alerts cannot load, and loads them again", async () => {
    const user = userEvent.setup();
    mockViewport(false);
    const listAlerts = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "Server error"))
      .mockResolvedValue({ data: [alert("al1", "a1")] });
    renderSection(listAlerts);

    expect(await screen.findByText("Could not load your alerts")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Apple Inc.")).toBeVisible();
  });
});
