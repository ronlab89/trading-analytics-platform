import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ScenarioComparePage } from "./scenario-compare-page";

const usd = (amount: string) => ({ amount, currency: "USD" });

const growth = {
  id: "p1",
  userId: "u1",
  name: "Growth",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const scenario = (id: string, name: string, assetId: string, percentChange: number) => ({
  id,
  portfolioId: "p1",
  name,
  description: null,
  baseSnapshotId: null,
  status: "SAVED",
  changes: [{ assetId, percentChange }],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const scenarios = [
  scenario("s1", "Apple falls", "a1", -10),
  scenario("s2", "Microsoft rallies", "a2", 5),
  scenario("s3", "Oil spikes", "a1", 3),
];

const metrics = (total: string, pnl: string, percent: number) => ({
  totalValue: usd(total),
  investedValue: usd("100000.00"),
  unrealizedPnL: usd(pnl),
  unrealizedPnLPercent: percent,
});

const compared = (id: string, name: string, total: string) => ({
  scenarioId: id,
  name,
  status: "SAVED",
  metrics: metrics(total, "1000.00", 2),
  difference: { totalValue: usd("10.00"), totalValuePercent: 1, unrealizedPnL: usd("10.00") },
  assets: [],
  unmatchedAssetIds: [],
});

const comparisonOf = (ids: string[]) => ({
  baseline: { metrics: metrics("125430.00", "25430.00", 6.12), assets: [] },
  scenarios: ids.map((id) =>
    compared(id, scenarios.find((entry) => entry.id === id)?.name ?? id, "121416.00"),
  ),
});

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientWith(answers: Answers = {}) {
  const base: Answers = {
    listPortfolios: () => Promise.resolve({ data: [growth] }),
    listScenarios: () => Promise.resolve({ data: scenarios }),
    getAsset: (input) =>
      Promise.resolve({
        data: {
          id: input?.params?.assetId,
          symbol: input?.params?.assetId === "a1" ? "AAPL" : "MSFT",
        },
      }),
    compareScenarios: (input) =>
      Promise.resolve({
        data: comparisonOf((input?.body as { scenarioIds: string[] }).scenarioIds),
      }),
    ...answers,
  };
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = base[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  const comparisons = () =>
    call.mock.calls
      .filter(([operation]) => operation.operationId === "compareScenarios")
      .map(([, input]) => input?.body);
  return { client: { call } as unknown as TradingClient, comparisons };
}

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

function renderPage(client: TradingClient, address = "/decisions/lab/compare?ids=s1,s2") {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route element={<ScenarioComparePage />} path="/decisions/lab/compare" />
          <Route element={<p>The Decision Center</p>} path="/decisions" />
        </Routes>
        <Where />
      </MemoryRouter>
    </Wrapper>,
  );
}

const ready = () => screen.findByRole("region", { name: "Apple falls" }, { timeout: 4000 });

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
});

describe("ScenarioComparePage", () => {
  it("names the page and asks for the scenarios of the address, in that order", async () => {
    const { client, comparisons } = clientWith();
    renderPage(client, "/decisions/lab/compare?ids=s2,s1");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Compare scenarios" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(comparisons()).toEqual([{ scenarioIds: ["s2", "s1"] }]);
    });
  });

  it("draws the way back, the cards with the main variable from the list and the table", async () => {
    renderPage(clientWith().client);
    await ready();

    expect(screen.getByRole("link", { name: "Back to scenarios" })).toHaveAttribute(
      "href",
      "/decisions?tab=lab",
    );
    expect(
      await within(screen.getByRole("region", { name: "Apple falls" })).findByText(
        "AAPL price -10 %",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Microsoft rallies" })).getByText("Scenario B"),
    ).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Differences" })).toBeInTheDocument();
  });

  it.each([
    ["no scenarios", "/decisions/lab/compare"],
    ["an empty list", "/decisions/lab/compare?ids="],
    ["only one", "/decisions/lab/compare?ids=s1"],
    ["a repeated one", "/decisions/lab/compare?ids=s1,s1"],
    ["more than five", "/decisions/lab/compare?ids=a,b,c,d,e,f"],
  ])("goes back to the scenarios when the address has %s", async (_label, address) => {
    const { client, comparisons } = clientWith();
    renderPage(client, address);

    expect(await screen.findByText("The Decision Center")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/decisions?tab=lab");
    expect(comparisons()).toEqual([]);
  });

  it("changes the scenarios with the dialog and writes them in the address", async () => {
    const { client, comparisons } = clientWith();
    renderPage(client);
    await ready();

    await userEvent.click(screen.getByRole("button", { name: "Change scenarios" }));
    const dialog = await screen.findByRole("dialog", { name: "Compare scenarios" });
    expect(await within(dialog).findByRole("checkbox", { name: "Apple falls" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Apple falls" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Oil spikes" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Compare" }));

    await waitFor(() => {
      expect(screen.getByTestId("where")).toHaveTextContent("/decisions/lab/compare?ids=s2%2Cs3");
    });
    await waitFor(() => {
      expect(comparisons()).toEqual([{ scenarioIds: ["s1", "s2"] }, { scenarioIds: ["s2", "s3"] }]);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("holds the place of the figures and cannot change the scenarios while they load", async () => {
    renderPage(clientWith({ compareScenarios: () => new Promise(() => undefined) }).client);

    expect(
      await screen.findByRole("status", { name: "Comparing the scenarios" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change scenarios" })).toBeDisabled();
  });

  it("gives the not-found page when one of the scenarios does not exist", async () => {
    renderPage(
      clientWith({
        compareScenarios: () => Promise.reject(new ApiError("NOT_FOUND", "No such scenario.", 404)),
      }).client,
    );

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("says it could not compare, keeps the way back and asks again on retry", async () => {
    const compareScenarios = vi
      .fn<(input?: CallInput) => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "offline"))
      .mockImplementation((input) =>
        Promise.resolve({
          data: comparisonOf((input?.body as { scenarioIds: string[] }).scenarioIds),
        }),
      );
    renderPage(clientWith({ compareScenarios }).client);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not compare the scenarios");
    expect(screen.getByRole("link", { name: "Back to scenarios" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await ready()).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage(clientWith().client);
    await ready();

    expect(await axe(container)).toHaveNoViolations();
  });
});
