import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { WatchlistRow } from "../types";
import { WatchlistView } from "./watchlist-view";

function row(
  assetId: string,
  symbol: string,
  name: string,
  price: string | null,
  changePercent: number | null,
  assetType: WatchlistRow["assetType"] = "STOCK",
  exchange = "NASDAQ",
): WatchlistRow {
  return {
    assetId,
    symbol,
    name,
    assetType,
    exchange,
    price: price === null ? null : { amount: price, currency: "USD" },
    changePercent,
  };
}

const rows = [
  row("a1", "AAPL", "Apple Inc.", "180.70", 2.1),
  row("a2", "KO", "Coca-Cola", "60.21", -0.6),
  row("a3", "SPY", "SPDR S&P 500 ETF", "560.20", 0.5, "ETF"),
];

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((tableRow) => within(tableRow).getByRole("rowheader").textContent);

describe("WatchlistView", () => {
  it("draws each asset with its type, exchange, price and signed change", () => {
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    const apple = screen.getByRole("row", { name: /Apple Inc\./ });
    expect(within(apple).getByText("Stock")).toBeVisible();
    expect(within(apple).getByText("NASDAQ")).toBeVisible();
    expect(within(apple).getByText("$180.70")).toBeVisible();
    expect(within(apple).getByText("+2.10%")).toBeVisible();
    expect(screen.getByText("-0.60%")).toBeVisible();
    expect(screen.getByText("ETF")).toBeVisible();
  });

  it("shows a dash for a price or a change the API did not give", () => {
    render(
      <WatchlistView onRemove={vi.fn()} rows={[row("a1", "AAPL", "Apple Inc.", null, null)]} />,
    );

    const apple = screen.getByRole("row", { name: /Apple Inc\./ });
    expect(within(apple).getAllByText("—")).toHaveLength(2);
  });

  it("finds an asset by its name, ignoring case", async () => {
    const user = userEvent.setup();
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search your watchlist" }), "coca");

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Coca-Cola")).toBeVisible();
  });

  it("finds an asset by its symbol", async () => {
    const user = userEvent.setup();
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search your watchlist" }), "spy");

    expect(screen.getByText("SPDR S&P 500 ETF")).toBeVisible();
    expect(screen.queryByText("Coca-Cola")).not.toBeInTheDocument();
  });

  it("sorts by price, ascending and then descending", async () => {
    const user = userEvent.setup();
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    await user.click(screen.getByRole("button", { name: /Price/ }));
    expect(names()).toEqual(["KOCoca-Cola", "AAPLApple Inc.", "SPYSPDR S&P 500 ETF"]);

    await user.click(screen.getByRole("button", { name: /Price/ }));
    expect(names()).toEqual(["SPYSPDR S&P 500 ETF", "AAPLApple Inc.", "KOCoca-Cola"]);
  });

  it("does not sort by today's change", () => {
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    expect(screen.queryByRole("button", { name: /Change today/ })).not.toBeInTheDocument();
  });

  it("asks to remove the asset whose star is pressed", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<WatchlistView onRemove={onRemove} rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Remove KO from the watchlist" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(rows[1]);
  });

  it("says so and offers to clear the search when nothing matches", async () => {
    const user = userEvent.setup();
    render(<WatchlistView onRemove={vi.fn()} rows={rows} />);

    await user.type(screen.getByRole("searchbox"), "zzz");

    expect(screen.getByText("No results")).toBeVisible();
    expect(screen.getByText('No asset on your watchlist matches "zzz".')).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(screen.getByText("Apple Inc.")).toBeVisible();
  });
});

describe("WatchlistView on a phone", () => {
  it("draws a card per asset with its type, exchange, price and change", () => {
    render(<WatchlistView mobile onRemove={vi.fn()} rows={rows} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const apple = screen.getByText("Apple Inc.").closest("li");
    expect(apple).not.toBeNull();
    expect(within(apple as HTMLElement).getByText("Stock · NASDAQ")).toBeVisible();
    expect(within(apple as HTMLElement).getByText("$180.70")).toBeVisible();
    expect(within(apple as HTMLElement).getByText("+2.10%")).toBeVisible();
  });

  it("searches the cards by name or symbol", async () => {
    const user = userEvent.setup();
    render(<WatchlistView mobile onRemove={vi.fn()} rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search your watchlist" }), "ko");

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Coca-Cola")).toBeVisible();
  });

  it("asks to remove the asset whose star is pressed", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<WatchlistView mobile onRemove={onRemove} rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Remove SPY from the watchlist" }));

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(rows[2]);
  });

  it("says so when the search matches nothing", async () => {
    const user = userEvent.setup();
    render(<WatchlistView mobile onRemove={vi.fn()} rows={rows} />);

    await user.type(screen.getByRole("searchbox"), "zzz");

    expect(screen.getByText("No results")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("WatchlistView exchange names", () => {
  const voo = row("a9", "VOO", "Vanguard S&P 500", "500.00", 0.3, "ETF", "NYSEARCA");

  it("writes the exchange as people do in the table", () => {
    render(<WatchlistView onRemove={vi.fn()} rows={[voo]} />);

    expect(screen.getByText("NYSE Arca")).toBeVisible();
    expect(screen.queryByText("NYSEARCA")).not.toBeInTheDocument();
  });

  it("writes it the same way in the phone cards", () => {
    render(<WatchlistView mobile onRemove={vi.fn()} rows={[voo]} />);

    expect(screen.getByText("ETF · NYSE Arca")).toBeVisible();
  });
});
