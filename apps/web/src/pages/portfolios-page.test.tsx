import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type TradingClient } from "@/api/trading-client";
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

const listing: TradingClient = {
  call: () =>
    Promise.resolve({
      data: [
        portfolio("p1", "Conservador"),
        portfolio("p2", "Crecimiento"),
        portfolio("p3", "Experimental", "EUR", "ARCHIVED"),
      ],
    }),
};

function renderPage(client: TradingClient = listing) {
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

  it("narrows the list as the user searches by name, and the count and footer follow", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Portfolios" });
    expect(screen.getByText("3 portfolios")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–3 of 3")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search portfolio" }), "cre");

    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("row", { name: /Crecimiento/ })).toBeInTheDocument();
    expect(screen.getByText("1 portfolio")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Manage your portfolios · 3 in total")).toBeInTheDocument();
  });

  it("sorts by name and by base currency, but not by status", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Portfolios" });
    const names = () =>
      screen
        .getAllByRole("rowheader")
        .map(
          (cell) => within(cell).getByText(/^(Conservador|Crecimiento|Experimental)$/).textContent,
        );
    expect(screen.queryByRole("button", { name: "Status" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    await userEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(names()).toEqual(["Experimental", "Crecimiento", "Conservador"]);

    await userEvent.click(screen.getByRole("button", { name: "Base currency" }));
    expect(names()).toEqual(["Experimental", "Conservador", "Crecimiento"]);
    expect(screen.getByRole("columnheader", { name: "Base currency" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("holds the place of the list with a loading status and a disabled search while it loads", () => {
    renderPage({ call: () => new Promise(() => undefined) });

    expect(screen.getByRole("status", { name: "Loading portfolios" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search portfolio" })).toBeDisabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("invites the user to create the first portfolio when there are none", async () => {
    renderPage({ call: () => Promise.resolve({ data: [] }) });

    expect(await screen.findByText("You have no portfolios yet")).toBeInTheDocument();
    expect(screen.getByText("Manage your portfolios · 0 in total")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says nothing matches the search and clears it on request", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Portfolios" });

    await userEvent.type(screen.getByRole("searchbox", { name: "Search portfolio" }), "Bonos");

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText(/No portfolio matches “Bonos”/)).toBeInTheDocument();
    expect(screen.getByText("0 portfolios")).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("searchbox", { name: "Search portfolio" })).toHaveValue("");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  });

  it("tells the user the list failed and loads it when they retry", async () => {
    const call = vi
      .fn<TradingClient["call"]>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "down"))
      .mockImplementation((operation, input) => listing.call(operation, input));
    renderPage({ call });

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the portfolios");
    expect(screen.queryByText(/in total/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("table", { name: "Portfolios" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage();
    await screen.findByRole("table", { name: "Portfolios" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
