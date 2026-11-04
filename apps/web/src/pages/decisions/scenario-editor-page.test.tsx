import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { ScenarioEditorPage } from "./scenario-editor-page";

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

const scenario = (
  status = "DRAFT",
  changes: { assetId: string; percentChange: number }[] = [{ assetId: "a1", percentChange: -10 }],
) => ({
  id: "s1",
  portfolioId: "p1",
  name: "Apple falls",
  description: null,
  baseSnapshotId: null,
  status,
  changes,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const position = {
  id: "pos-a1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 10,
  averageEntryPrice: usd("100.00"),
  currentPrice: usd("180.70"),
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

const metrics = (total: string, percent: number) => ({
  totalValue: usd(total),
  investedValue: usd("900.00"),
  unrealizedPnL: usd("0.00"),
  unrealizedPnLPercent: percent,
});

const calculation = {
  scenarioId: "s1",
  baseline: metrics("1000.00", 6.12),
  result: metrics("900.00", 2.72),
  difference: { totalValue: usd("-100.00"), unrealizedPnL: usd("-100.00") },
  unmatchedAssetIds: [],
};

type Answers = Partial<Record<string, (input?: CallInput) => Promise<unknown>>>;

function clientWith(answers: Answers = {}) {
  const base: Answers = {
    listPortfolios: () => Promise.resolve({ data: [growth] }),
    getScenario: () => Promise.resolve({ data: scenario() }),
    listPositions: () => Promise.resolve({ data: [position] }),
    getAsset: () => Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } }),
    calculateScenario: () => Promise.resolve({ data: calculation }),
    updateScenario: (input) =>
      Promise.resolve({ data: { ...scenario("DRAFT", []), ...(input?.body as object) } }),
    deleteScenario: () => Promise.resolve(undefined),
    ...answers,
  };
  const call = vi.fn((operation: { operationId: string }, input?: CallInput) => {
    const answer = base[operation.operationId];
    return answer === undefined
      ? Promise.reject(new Error(`unexpected ${operation.operationId}`))
      : answer(input);
  });
  const calls = (operationId: string) =>
    call.mock.calls.filter(([operation]) => operation.operationId === operationId);
  return { client: { call } as unknown as TradingClient, calls };
}

function renderPage(client: TradingClient) {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={["/decisions/lab/s1"]}>
        <Routes>
          <Route element={<ScenarioEditorPage />} path="/decisions/lab/:scenarioId" />
          <Route element={<p>The Decision Center</p>} path="/decisions" />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
}

/**
 * The editor is ready once the page has its name and the variables are drawn. It asks for the
 * scenario, then the positions, then their assets, so a loaded machine needs more than the default
 * second.
 */
const loaded = async () => {
  const heading = await screen.findByRole(
    "heading",
    { level: 1, name: "Apple falls" },
    { timeout: 4000 },
  );
  await screen.findByRole("region", { name: "Variables" }, { timeout: 4000 });
  return heading;
};

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
});

// `vi.unstubAllGlobals` would also take away the stubs of the test setup (the slider needs one), so
// the one stub this file makes is put back by hand.
const originalMatchMedia: unknown = Reflect.get(window, "matchMedia");

afterEach(() => {
  Reflect.set(window, "matchMedia", originalMatchMedia);
});

describe("ScenarioEditorPage", () => {
  it("names the page by the scenario and asks for it in the active portfolio", async () => {
    const { client, calls } = clientWith();
    renderPage(client);

    expect(await loaded()).toBeInTheDocument();
    expect(calls("getScenario")[0]?.[1]).toEqual({
      params: { portfolioId: "p1", scenarioId: "s1" },
    });
  });

  it("draws the way back to the scenarios, the variables and the impact", async () => {
    renderPage(clientWith().client);
    await loaded();

    expect(screen.getByRole("link", { name: "Back to scenarios" })).toHaveAttribute(
      "href",
      "/decisions?tab=lab",
    );
    expect(await screen.findByRole("slider", { name: "AAPL price" })).toHaveAttribute(
      "aria-valuenow",
      "-10",
    );
    expect(await screen.findByText("$900.00")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Variables" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scenario impact" })).toBeInTheDocument();
  });

  it("says a draft is unsaved and a saved scenario is not", async () => {
    const draft = renderPage(clientWith().client);
    await loaded();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    draft.unmount();

    renderPage(
      clientWith({ getScenario: () => Promise.resolve({ data: scenario("SAVED") }) }).client,
    );
    await loaded();
    expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
  });

  it("resets to no changes with one request, and only when there is something to reset", async () => {
    const { client, calls } = clientWith();
    renderPage(client);
    await loaded();

    await userEvent.click(await screen.findByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(calls("updateScenario")).toHaveLength(1);
    });
    expect(calls("updateScenario")[0]?.[1]?.body).toEqual({ changes: [] });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });
  });

  it("on a phone, keeps the reset under the variables and shortens the save button, as the Figma does", async () => {
    window.matchMedia = ((query: string) => ({
      media: query,
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const { client, calls } = clientWith();
    renderPage(client);
    await loaded();

    const variables = within(await screen.findByRole("region", { name: "Variables" }));
    expect(screen.getAllByRole("button", { name: "Reset" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save scenario" })).not.toBeInTheDocument();

    await userEvent.click(variables.getByRole("button", { name: "Reset" }));
    await waitFor(() => {
      expect(calls("updateScenario")[0]?.[1]?.body).toEqual({ changes: [] });
    });
  });

  it("has nothing to reset in a scenario without changes", async () => {
    renderPage(
      clientWith({ getScenario: () => Promise.resolve({ data: scenario("DRAFT", []) }) }).client,
    );
    await loaded();

    expect(await screen.findByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("opens the dialog that names and saves the scenario", async () => {
    renderPage(clientWith().client);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    expect(await screen.findByRole("dialog", { name: "Save scenario" })).toBeInTheDocument();
  });

  it("deletes the scenario after asking, and goes back to the Decision Center", async () => {
    const { client, calls } = clientWith();
    renderPage(client);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete scenario" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete scenario" }));

    expect(await screen.findByText("The Decision Center")).toBeInTheDocument();
    expect(calls("deleteScenario")[0]?.[1]).toEqual({
      params: { portfolioId: "p1", scenarioId: "s1" },
    });
  });

  it("holds the place of the editor while the scenario loads", async () => {
    renderPage(clientWith({ getScenario: () => new Promise(() => undefined) }).client);

    expect(await screen.findByRole("status", { name: "Loading the scenario" })).toBeInTheDocument();
  });

  it("gives the not-found page for a scenario that does not exist", async () => {
    renderPage(
      clientWith({
        getScenario: () => Promise.reject(new ApiError("NOT_FOUND", "No such scenario.", 404)),
      }).client,
    );

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("says it could not open the scenario, keeps the way back and asks again on retry", async () => {
    const getScenario = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new ApiError("NETWORK_ERROR", "offline"))
      .mockResolvedValue({ data: scenario() });
    renderPage(clientWith({ getScenario }).client);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not open the scenario");
    expect(screen.getByRole("link", { name: "Back to scenarios" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await loaded()).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage(clientWith().client);
    await loaded();
    await screen.findByText("$900.00");

    expect(await axe(container)).toHaveNoViolations();
  });
});
