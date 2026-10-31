import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { PortfolioRow } from "../types";
import { PortfolioCardList } from "./portfolio-card-list";

const portfolios: PortfolioRow[] = [
  { id: "p1", name: "Conservador", baseCurrency: "USD", status: "ACTIVE" },
  { id: "p2", name: "Crecimiento", baseCurrency: "USD", status: "ACTIVE" },
  { id: "p3", name: "Experimental", baseCurrency: "EUR", status: "ARCHIVED" },
];

function renderList(activeId?: string) {
  return render(
    <MemoryRouter>
      <PortfolioCardList activeId={activeId} portfolios={portfolios} />
    </MemoryRouter>,
  );
}

describe("PortfolioCardList", () => {
  it("is a named list with one card per portfolio", () => {
    renderList();

    const list = screen.getByRole("list", { name: "Portfolios" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("opens the detail of a portfolio from its card, archived ones included", () => {
    renderList();

    expect(screen.getByRole("link", { name: /Conservador/ })).toHaveAttribute(
      "href",
      "/portfolios/p1",
    );
    expect(screen.getByRole("link", { name: /Experimental/ })).toHaveAttribute(
      "href",
      "/portfolios/p3",
    );
  });

  it("says under the name which currency an active portfolio is in", () => {
    renderList();

    expect(
      within(screen.getByRole("link", { name: /Conservador/ })).getByText("USD"),
    ).toBeInTheDocument();
  });

  it("says “In use” instead of the currency for the portfolio in use, as the Figma does", () => {
    renderList("p2");

    const card = screen.getByRole("link", { name: /Crecimiento/ });
    expect(within(card).getByText("In use")).toBeInTheDocument();
    expect(within(card).queryByText("USD")).not.toBeInTheDocument();
  });

  it("says “Archived” instead of the currency for an archived portfolio, as the Figma does", () => {
    renderList();

    const card = screen.getByRole("link", { name: /Experimental/ });
    expect(within(card).getByText("Archived")).toBeInTheDocument();
    expect(within(card).queryByText("EUR")).not.toBeInTheDocument();
  });

  it("marks the in-use portfolio with a dark avatar and the others with a neutral one", () => {
    renderList("p2");

    const dark = screen
      .getByRole("link", { name: /Crecimiento/ })
      .querySelector("span[aria-hidden]");
    const neutral = screen
      .getByRole("link", { name: /Conservador/ })
      .querySelector("span[aria-hidden]");
    expect(dark?.className).toContain("avatar-dark");
    expect(neutral?.className).toContain("avatar-neutral");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderList("p2");

    expect(await axe(container)).toHaveNoViolations();
  });
});
