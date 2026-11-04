import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ApiError, type CallInput, type TradingClient } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { DecisionsPage } from "./decisions-page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const decision = (id: string, title: string, closedAt: string | null = null) => ({
  id,
  portfolioId: "p1",
  assetId: "a1",
  title,
  thesis: "A thesis.",
  direction: "LONG",
  entryPrice: { amount: "150.00", currency: "USD" },
  targetPrice: null,
  stopPrice: null,
  riskLevel: null,
  createdAt: "2026-06-01T14:00:00.000Z",
  closedAt,
  outcome: null,
  notes: null,
});

const decisions = [
  decision("d1", "Buy the dip"),
  decision("d2", "Cut the loss", "2026-06-20T14:00:00.000Z"),
  decision("d3", "Wait and see"),
];

const scenario = (id: string, name: string, status = "SAVED") => ({
  id,
  portfolioId: "p1",
  name,
  description: null,
  baseSnapshotId: null,
  status,
  changes: [{ assetId: "a1", percentChange: -10 }],
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-12T10:00:00.000Z",
});

const metrics = (total: string) => ({
  totalValue: { amount: total, currency: "USD" },
  investedValue: { amount: "900.00", currency: "USD" },
  unrealizedPnL: { amount: "0.00", currency: "USD" },
  unrealizedPnLPercent: 0,
});

const calculation = {
  scenarioId: "s1",
  baseline: metrics("1000.00"),
  result: metrics("900.00"),
  difference: {
    totalValue: { amount: "-100.00", currency: "USD" },
    unrealizedPnL: { amount: "-100.00", currency: "USD" },
  },
  unmatchedAssetIds: [],
};

interface Answers {
  listPortfolios?: () => Promise<unknown>;
  listDecisions?: () => Promise<unknown>;
  listScenarios?: () => Promise<unknown>;
  createScenario?: () => Promise<unknown>;
}

function clientWith(answers: Answers = {}) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      switch (operation.operationId) {
        case "listPortfolios":
          return answers.listPortfolios?.() ?? Promise.resolve({ data: [growth] });
        case "listDecisions":
          return answers.listDecisions?.() ?? Promise.resolve({ data: decisions });
        case "listScenarios":
          return answers.listScenarios?.() ?? Promise.resolve({ data: [] });
        case "getScenario":
          return Promise.resolve({ data: scenario("s1", "Apple falls") });
        case "createScenario":
          return (
            answers.createScenario?.() ??
            Promise.resolve({ data: scenario("s9", "Apple falls (copy)", "DRAFT") })
          );
        case "updateScenario":
          return Promise.resolve({ data: scenario("s9", "Apple falls (copy)") });
        case "deleteScenario":
          return Promise.resolve(undefined);
        case "calculateScenario":
          return Promise.resolve({ data: calculation });
        case "getAsset":
          return Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } });
        default:
          return Promise.resolve({ data: [] });
      }
    },
  );
  return { client: { call } as TradingClient, call };
}

/** Shows where the router is, so a test can tell that a click went to another page. */
function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderPage(client: TradingClient, address = "/decisions") {
  const Wrapper = tradingClientWrapper(client);
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[address]}>
        <DecisionsPage />
        <Where />
      </MemoryRouter>
    </Wrapper>,
  );
}

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
  useSessionStore.getState().signOut();
});

describe("DecisionsPage", () => {
  it("names the page for screen readers", () => {
    renderPage(clientWith().client);

    expect(screen.getByRole("heading", { level: 1, name: "Decision Center" })).toBeInTheDocument();
  });

  it("lists the decisions of the active portfolio and counts them, open ones apart", async () => {
    const { client, call } = clientWith();
    renderPage(client);

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
    expect(screen.getByRole("row", { name: /Cut the loss/ })).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Buy the dip/ })).getByText("AAPL"),
    ).toBeVisible();
    const listed = call.mock.calls.find(([operation]) => operation.operationId === "listDecisions");
    expect(listed?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("holds the place of the table while the decisions load", async () => {
    renderPage(clientWith({ listDecisions: () => new Promise(() => undefined) }).client);

    expect(await screen.findByRole("status", { name: "Loading the decisions" })).toBeVisible();
  });

  it("offers a first transaction when the portfolio has no decisions", async () => {
    const user = userEvent.setup();
    renderPage(clientWith({ listDecisions: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("No decisions yet")).toBeVisible();
    expect(screen.queryByText(/decisions recorded/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New transaction" }));

    expect(await screen.findByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
  });

  it("offers a retry when the decisions cannot load, and asks again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderPage(
      clientWith({
        listDecisions: () =>
          fail
            ? Promise.reject(new ApiError("INTERNAL_ERROR", "Server error"))
            : Promise.resolve({ data: decisions }),
      }).client,
    );

    expect(await screen.findByText("Could not load the decisions")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
  });

  it("asks for a portfolio when the user has none", async () => {
    renderPage(clientWith({ listPortfolios: () => Promise.resolve({ data: [] }) }).client);

    expect(await screen.findByText("You have no portfolios yet")).toBeInTheDocument();
  });

  it("offers a retry when the portfolios cannot load", async () => {
    renderPage(
      clientWith({
        listPortfolios: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
      }).client,
    );

    expect(await screen.findByText("Could not load the decisions")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("DecisionsPage, the Scenario Lab", () => {
  const scenarios = [
    scenario("s1", "Apple falls"),
    scenario("s2", "Archived idea", "ARCHIVED"),
    scenario("s3", "Draft idea", "DRAFT"),
  ];

  it("opens on the replay, with its tab selected", async () => {
    renderPage(clientWith().client);

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Replay" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Scenario Lab" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("switches to the scenarios of the portfolio and counts the saved ones with the base", async () => {
    const user = userEvent.setup();
    const { client, call } = clientWith({
      listScenarios: () => Promise.resolve({ data: scenarios }),
    });
    renderPage(client);

    await user.click(await screen.findByRole("tab", { name: "Scenario Lab" }));

    expect(await screen.findByRole("row", { name: /Apple falls/ })).toBeVisible();
    expect(screen.getByRole("row", { name: /Draft idea/ })).toBeVisible();
    expect(screen.queryByRole("row", { name: /Archived idea/ })).not.toBeInTheDocument();
    expect(await screen.findByText("1 scenario saved · base: Growth, $1,000.00")).toBeVisible();
    const listed = call.mock.calls.find(([operation]) => operation.operationId === "listScenarios");
    expect(listed?.[1]).toEqual({ params: { portfolioId: "p1" } });
  });

  it("opens straight on the lab when the address says so", async () => {
    renderPage(
      clientWith({ listScenarios: () => Promise.resolve({ data: scenarios }) }).client,
      "/decisions?tab=lab",
    );

    expect(await screen.findByRole("row", { name: /Apple falls/ })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Scenario Lab" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByText(/decisions recorded/)).not.toBeInTheDocument();
  });

  it("says that there are no scenarios yet, with no summary line", async () => {
    renderPage(clientWith().client, "/decisions?tab=lab");

    expect(await screen.findByText("No scenarios yet")).toBeVisible();
    expect(screen.queryByText(/scenarios? saved/)).not.toBeInTheDocument();
  });

  it("offers a retry when the scenarios cannot load", async () => {
    renderPage(
      clientWith({
        listScenarios: () => Promise.reject(new ApiError("INTERNAL_ERROR", "Server error")),
      }).client,
      "/decisions?tab=lab",
    );

    expect(await screen.findByText("Could not load the scenarios")).toBeVisible();
  });

  it("offers Compare on the Lab tab only, and it opens the picker", async () => {
    const user = userEvent.setup();
    renderPage(
      clientWith({
        listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
      }).client,
    );

    expect(screen.queryByRole("button", { name: "Compare" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: "Scenario Lab" }));
    await user.click(await screen.findByRole("button", { name: "Compare" }));

    expect(await screen.findByRole("dialog", { name: "Compare scenarios" })).toBeVisible();
  });

  it("creates a draft with a New scenario button on the Lab tab only, and opens it", async () => {
    const user = userEvent.setup();
    const { client, call } = clientWith({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
    });
    renderPage(client);

    expect(screen.queryByRole("button", { name: "New scenario" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: "Scenario Lab" }));
    await user.click(await screen.findByRole("button", { name: "New scenario" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/decisions/lab/s9");
    });
    const created = call.mock.calls.filter(([op]) => op.operationId === "createScenario");
    expect(created).toHaveLength(1);
    expect(created[0]?.[1]).toEqual({
      params: { portfolioId: "p1" },
      body: { name: "New scenario" },
    });
  });

  it("offers the same from the empty state of the Lab", async () => {
    const user = userEvent.setup();
    renderPage(clientWith().client, "/decisions?tab=lab");

    await screen.findByText("No scenarios yet");
    const panel = within(screen.getByRole("tabpanel", { name: "Scenario Lab" }));
    await user.click(panel.getByRole("button", { name: "New scenario" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/decisions/lab/s9");
    });
  });

  it("stays on the list and says why when the draft cannot be created", async () => {
    const user = userEvent.setup();
    renderPage(
      clientWith({
        listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
        createScenario: () =>
          Promise.reject(new ApiError("CONFLICT", "The portfolio is archived.", 409)),
      }).client,
      "/decisions?tab=lab",
    );

    await user.click(await screen.findByRole("button", { name: "New scenario" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not create the scenario", {
        description: "The portfolio is archived.",
      });
    });
    expect(screen.getByTestId("path")).toHaveTextContent("/decisions");
    expect(screen.getByTestId("path")).not.toHaveTextContent("lab");
  });

  it("opens the editor of a scenario from the menu of its row", async () => {
    const user = userEvent.setup();
    const { client } = clientWith({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
    });
    renderPage(client, "/decisions?tab=lab");

    await user.click(await screen.findByRole("button", { name: "Actions for “Apple falls”" }));
    await user.click(screen.getByRole("menuitem", { name: "Open" }));

    expect(screen.getByTestId("path")).toHaveTextContent("/decisions/lab/s1");
  });

  it("duplicates a scenario from the menu of its row, with the name of a copy", async () => {
    const user = userEvent.setup();
    const { client, call } = clientWith({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
    });
    renderPage(client, "/decisions?tab=lab");

    await user.click(await screen.findByRole("button", { name: "Actions for “Apple falls”" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    await waitFor(() => {
      expect(call.mock.calls.some(([op]) => op.operationId === "updateScenario")).toBe(true);
    });
    const created = call.mock.calls.find(([op]) => op.operationId === "createScenario");
    expect(created?.[1]).toEqual({
      params: { portfolioId: "p1" },
      body: {
        name: "Apple falls (copy)",
        changes: [{ assetId: "a1", percentChange: -10 }],
      },
    });
  });

  it("deletes a scenario only after the confirmation", async () => {
    const user = userEvent.setup();
    const { client, call } = clientWith({
      listScenarios: () => Promise.resolve({ data: [scenario("s1", "Apple falls")] }),
    });
    renderPage(client, "/decisions?tab=lab");
    const deleteCalls = () => call.mock.calls.filter(([op]) => op.operationId === "deleteScenario");

    await user.click(await screen.findByRole("button", { name: "Actions for “Apple falls”" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByRole("dialog", { name: "Delete scenario" })).toBeVisible();
    expect(deleteCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Delete scenario" }));

    await waitFor(() => {
      expect(deleteCalls()).toHaveLength(1);
    });
    expect(deleteCalls()[0]?.[1]).toEqual({ params: { portfolioId: "p1", scenarioId: "s1" } });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("goes back to the replay with its tab", async () => {
    const user = userEvent.setup();
    renderPage(clientWith().client, "/decisions?tab=lab");

    await user.click(await screen.findByRole("tab", { name: "Replay" }));

    expect(await screen.findByText("3 decisions recorded · 2 open")).toBeVisible();
  });
});

describe("DecisionsPage on a phone", () => {
  afterEach(() => {
    vi.stubGlobal("matchMedia", undefined);
  });

  it("shows the title and the decisions as cards", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    renderPage(clientWith().client);

    expect(
      await within(await screen.findByRole("list", { name: "Decisions" })).findAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 1, name: "Decision Center" })).toHaveClass(
      "text-2xl",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
