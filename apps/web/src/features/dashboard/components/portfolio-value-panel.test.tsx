import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { PortfolioValuePanel } from "./portfolio-value-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

function renderPanel(props: Partial<Parameters<typeof PortfolioValuePanel>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PortfolioValuePanel
        dailyChange={{ changeValue: usd("2340.10"), changePercent: 1.9 }}
        empty={false}
        firstName="Jane"
        onNew={vi.fn()}
        portfolioId="p1"
        totalValue={usd("125430.25")}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("PortfolioValuePanel", () => {
  it("greets the user by first name and says what the panel is", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Hello, Jane" })).toBeInTheDocument();
    expect(screen.getByText("Here's how your portfolio is doing today")).toBeInTheDocument();
  });

  it("greets without a name when the user has none", () => {
    renderPanel({ firstName: "" });

    expect(screen.getByRole("heading", { name: "Hello" })).toBeInTheDocument();
  });

  it("shows the total value of the portfolio", () => {
    renderPanel();

    expect(screen.getByText("$125,430.25")).toBeInTheDocument();
  });

  it("shows today's gain with its percentage and its amount", () => {
    renderPanel();

    expect(screen.getByText("+1.90%")).toBeInTheDocument();
    expect(screen.getByText("+$2,340.10")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("shows today's loss with a minus", () => {
    renderPanel({ dailyChange: { changeValue: usd("-1958.00"), changePercent: -1.54 } });

    expect(screen.getByText("-1.54%")).toBeInTheDocument();
    expect(screen.getByText("-$1,958.00")).toBeInTheDocument();
  });

  it("shows only the value when the API could not work today's change out", () => {
    renderPanel({ dailyChange: null });

    expect(screen.getByText("$125,430.25")).toBeInTheDocument();
    expect(screen.queryByText("today")).not.toBeInTheDocument();
  });

  it("links to the portfolio", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "View portfolio" })).toHaveAttribute(
      "href",
      "/portfolios/p1",
    );
  });

  it("says the portfolio is empty and offers a first transaction", async () => {
    const onNew = vi.fn();
    renderPanel({ empty: true, onNew });

    expect(screen.getByText("Your portfolio is empty")).toBeInTheDocument();
    expect(screen.queryByText("$125,430.25")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View portfolio" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New transaction" }));

    expect(onNew).toHaveBeenCalledOnce();
  });
});

describe("PortfolioValuePanel children", () => {
  it("puts them under the value", () => {
    renderPanel({ children: <p>Monthly bars</p> });

    expect(screen.getByText("Monthly bars")).toBeInTheDocument();
  });

  it("leaves them out of an empty portfolio", () => {
    renderPanel({ empty: true, children: <p>Monthly bars</p> });

    expect(screen.queryByText("Monthly bars")).not.toBeInTheDocument();
  });
});
