import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import type { TradingClient } from "@/api/trading-client";
import { PortfoliosPage } from "@/pages/portfolios-page";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";

function portfolio(
  id: string,
  name: string,
  baseCurrency = "USD",
  status: "ACTIVE" | "ARCHIVED" = "ACTIVE",
) {
  return {
    id,
    userId: "u1",
    name,
    description: null,
    baseCurrency,
    status,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const client: TradingClient = {
  call: () =>
    Promise.resolve({
      data: [
        portfolio("p1", "Conservador"),
        portfolio("p2", "Crecimiento"),
        portfolio("p3", "Experimental", "EUR", "ARCHIVED"),
      ],
    }),
};

function renderPage() {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <PortfoliosPage />
    </Wrapper>,
  );
}

beforeEach(() => {
  useActivePortfolioStore.setState(useActivePortfolioStore.getInitialState());
});

describe("PortfoliosPage", () => {
  it("lists every portfolio, archived ones included, with its base currency and status", async () => {
    renderPage();

    const table = await screen.findByRole("table", { name: "Portfolios" });
    const experimental = within(table).getByRole("row", { name: /Experimental/ });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(experimental).getByText("EUR")).toBeInTheDocument();
    expect(within(experimental).getByText("Archived")).toBeInTheDocument();
    expect(
      within(within(table).getByRole("row", { name: /Conservador/ })).getByText("Active"),
    ).toBeInTheDocument();
  });

  it("states how many portfolios there are", async () => {
    renderPage();

    expect(await screen.findByText("Manage your portfolios · 3 in total")).toBeInTheDocument();
  });

  it("tags only the portfolio in use", async () => {
    useActivePortfolioStore.getState().select("p2");
    renderPage();

    const table = await screen.findByRole("table", { name: "Portfolios" });
    expect(within(table).getAllByText("In use")).toHaveLength(1);
    expect(
      within(within(table).getByRole("row", { name: /Crecimiento/ })).getByText("In use"),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();
    await screen.findByRole("table", { name: "Portfolios" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
