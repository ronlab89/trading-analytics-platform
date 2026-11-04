import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import "@/i18n";
import type { DecisionRow } from "../types";
import { DecisionsView } from "./decisions-view";

const usd = (amount: string) => ({ amount, currency: "USD" });

function row(overrides: Partial<DecisionRow> & Pick<DecisionRow, "id" | "title">): DecisionRow {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    direction: "LONG",
    entryPrice: usd("100.00"),
    targetPrice: usd("120.00"),
    stopPrice: usd("90.00"),
    riskLevel: null,
    createdAt: "2026-06-01T14:00:00.000Z",
    outcome: null,
    status: "OPEN",
    ...overrides,
  };
}

const buyTheDip = row({ id: "d1", title: "Buy the dip", entryPrice: usd("150.00") });
const cutTheLoss = row({
  id: "d2",
  title: "Cut the loss",
  symbol: "NVDA",
  name: "NVIDIA",
  direction: "SHORT",
  entryPrice: usd("90.00"),
  stopPrice: usd("85.00"),
  status: "CLOSED",
  outcome: "Stop reached",
});
const waitAndSee = row({
  id: "d3",
  title: "Wait and see",
  symbol: "KO",
  name: "Coca-Cola",
  entryPrice: null,
});
const rows = [buyTheDip, cutTheLoss, waitAndSee];

/** The view inside a router, with a stand-in for the page a decision opens. */
const renderView = (ui: ReactElement) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={ui} path="/" />
        <Route element={<p>Detail of the decision</p>} path="/decisions/:decisionId" />
      </Routes>
    </MemoryRouter>,
  );

const titles = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((tableRow) => within(tableRow).getByRole("rowheader").textContent);

describe("DecisionsView", () => {
  it("draws each decision with its direction, prices, status and outcome", () => {
    renderView(<DecisionsView rows={rows} />);

    const closed = screen.getByRole("row", { name: /Cut the loss/ });
    expect(within(closed).getByText("Short")).toBeVisible();
    expect(within(closed).getByText("$90.00")).toBeVisible();
    expect(within(closed).getByText("Closed")).toBeVisible();
    expect(within(closed).getByText("Stop reached")).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Buy the dip/ })).getByText("Open"),
    ).toBeVisible();
  });

  it("shows a dash for a price or an outcome the decision does not have", () => {
    renderView(<DecisionsView rows={[waitAndSee]} />);

    const decision = screen.getByRole("row", { name: /Wait and see/ });
    expect(within(decision).getAllByText("—")).toHaveLength(2);
  });

  it("finds a decision by its title, its symbol or the name of its asset", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView rows={rows} />);
    const search = screen.getByRole("searchbox", { name: "Search decisions" });

    await user.type(search, "dip");
    expect(titles()).toEqual([expect.stringContaining("Buy the dip")]);

    await user.clear(search);
    await user.type(search, "nvda");
    expect(titles()).toEqual([expect.stringContaining("Cut the loss")]);

    await user.clear(search);
    await user.type(search, "coca");
    expect(titles()).toEqual([expect.stringContaining("Wait and see")]);
  });

  it("says nothing matches and clears the search from there", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search decisions" }), "tesla");

    expect(screen.getByText("No results")).toBeVisible();
    expect(screen.getByText('No decision matches "tesla".')).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(titles()).toHaveLength(3);
  });

  it("sorts by entry price and leaves the decisions without one last", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView rows={rows} />);

    await user.click(screen.getByRole("button", { name: /Entry/ }));
    expect(titles()).toEqual([
      expect.stringContaining("Cut the loss"),
      expect.stringContaining("Buy the dip"),
      expect.stringContaining("Wait and see"),
    ]);

    await user.click(screen.getByRole("button", { name: /Entry/ }));
    expect(titles()).toEqual([
      expect.stringContaining("Buy the dip"),
      expect.stringContaining("Cut the loss"),
      expect.stringContaining("Wait and see"),
    ]);
  });

  it("is a card list on a phone, with no prices", () => {
    renderView(<DecisionsView mobile rows={rows} />);

    const cards = within(screen.getByRole("list", { name: "Decisions" })).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(
      within(
        cards.find((card) => card.textContent.includes("Cut the loss")) ?? document.body,
      ).getByText("Stop reached"),
    ).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("$150.00")).not.toBeInTheDocument();
  });

  it("filters the phone cards with the same search", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView mobile rows={rows} />);

    await user.type(screen.getByRole("searchbox", { name: "Search decisions" }), "dip");

    expect(
      within(screen.getByRole("list", { name: "Decisions" })).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("opens a decision from the title in its row, which is a link", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView rows={rows} />);

    const link = within(screen.getByRole("row", { name: /Cut the loss/ })).getByRole("link", {
      name: "Cut the loss",
    });
    expect(link).toHaveAttribute("href", "/decisions/d2");

    await user.click(link);
    expect(screen.getByText("Detail of the decision")).toBeVisible();
  });

  it("opens a decision from its whole card on a phone", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView mobile rows={rows} />);

    const link = screen.getByRole("link", { name: /Buy the dip/ });
    expect(link).toHaveAttribute("href", "/decisions/d1");
    expect(within(link).getByText("Open")).toBeVisible();

    await user.click(link);
    expect(screen.getByText("Detail of the decision")).toBeVisible();
  });

  it("reaches the links with the keyboard", async () => {
    const user = userEvent.setup();
    renderView(<DecisionsView mobile rows={rows} />);

    await user.click(screen.getByRole("searchbox", { name: "Search decisions" }));
    await user.tab();

    expect(screen.getByRole("link", { name: /Buy the dip/ })).toHaveFocus();
  });
});
