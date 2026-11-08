import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ApiError, type CallInput } from "@/api/trading-client";
import { useActivePortfolioStore } from "@/stores/active-portfolio-store";
import { useSessionStore } from "@/stores/session-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import "@/i18n";
import { ActivityPage } from "./activity-page";

const portfolio = { id: "p1", name: "Main", status: "ACTIVE", baseCurrency: "USD" };

function notification(id: string, title: string, minutesAgo: number) {
  return {
    id,
    userId: "u1",
    type: "ALERT",
    title,
    message: `Details ${id}`,
    severity: "WARNING",
    readAt: null,
    createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    metadata: {},
  };
}

const transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 15,
  price: { amount: "129.30", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  realizedPnL: null,
  status: "COMPLETED",
  executedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

type Answers = Partial<Record<string, () => Promise<unknown>>>;

const healthy: Answers = {
  listPortfolios: () => Promise.resolve({ data: [portfolio] }),
  listNotifications: () =>
    Promise.resolve({
      data: [
        notification("n1", "Risk threshold exceeded", 30),
        notification("n2", "Sync failed", 60),
      ],
    }),
  listTransactions: () =>
    Promise.resolve({ data: [transaction], meta: { page: 1, pageSize: 100, total: 1 } }),
  getAsset: () => Promise.resolve({ data: { id: "a1", symbol: "AAPL", name: "Apple Inc." } }),
};

function renderPage(answers: Answers) {
  const call = vi.fn<(operation: { operationId: string }, input?: CallInput) => Promise<unknown>>(
    (operation) => {
      const answer = answers[operation.operationId];
      return answer ? answer() : Promise.reject(new Error(`Unexpected ${operation.operationId}`));
    },
  );
  const Wrapper = tradingClientWrapper({ call });
  return render(
    <Wrapper>
      <ActivityPage />
    </Wrapper>,
  );
}

beforeEach(() => {
  useActivePortfolioStore.setState({ selectedId: undefined });
});

afterEach(() => {
  useSessionStore.getState().signOut();
  sessionStorage.clear();
});

const runningJob = {
  id: "j1",
  portfolioId: "p1",
  status: "PROCESSING",
  stage: "VALIDATING",
  failureReason: null,
  report: null,
  progress: { processed: 40, total: 100 },
};

/** Signs in as a user whose device started one import, and answers the job as running. */
function withARunningImport(userId: string): Answers {
  sessionStorage.setItem(
    `trading:jobs:${userId}`,
    JSON.stringify([
      {
        id: "j1",
        portfolioId: "p1",
        fileName: "orders.csv",
        startedAt: new Date().toISOString(),
      },
    ]),
  );
  useSessionStore.getState().signIn({
    user: { id: userId, email: `${userId}@example.com`, displayName: userId, role: "TRADER" },
    session: { accessToken: "token", expiresAt: "2099-01-01T00:00:00.000Z" },
  });
  return { ...healthy, getJob: () => Promise.resolve({ data: runningJob }) };
}

describe("ActivityPage processes", () => {
  it("lists an import that is running with its bar", async () => {
    renderPage(withARunningImport("page-bar"));

    expect(await screen.findByText("Importing orders.csv")).toBeInTheDocument();
    expect(screen.getByText("Validating · 40 of 100")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Import progress" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
  });

  it("opens the import on its progress from View process", async () => {
    const user = userEvent.setup();
    renderPage(withARunningImport("page-open"));

    await user.click(await screen.findByRole("button", { name: "View process" }));

    const dialog = await screen.findByRole("dialog", { name: "Import transactions" });
    expect(within(dialog).getByText("Validating")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("choose a file")).not.toBeInTheDocument();
  });

  it("narrows the list to the processes with the Process source", async () => {
    const user = userEvent.setup();
    renderPage(withARunningImport("page-filter"));
    await screen.findByText("Importing orders.csv");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("checkbox", { name: "Process" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(screen.getByText("Importing orders.csv")).toBeInTheDocument();
    expect(screen.queryByText(/Risk threshold exceeded/)).not.toBeInTheDocument();
  });
});

describe("ActivityPage", () => {
  it("says how many events there are in the last 30 days and lists them by day", async () => {
    renderPage(healthy);

    expect(await screen.findByText("3 events · last 30 days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeInTheDocument();
    expect(screen.getByText(/Risk threshold exceeded/)).toBeInTheDocument();
    expect(screen.getByText(/Bought AAPL/)).toBeInTheDocument();
  });

  it("shows a loading state while the activity is coming", () => {
    renderPage({ ...healthy, listNotifications: () => new Promise(() => undefined) });

    expect(screen.getByRole("status", { name: "Loading the activity" })).toBeInTheDocument();
  });

  it("searches the title and the message, and says when nothing matches, with a way out", async () => {
    const user = userEvent.setup();
    renderPage(healthy);
    await screen.findByText(/Risk threshold exceeded/);

    await user.type(screen.getByRole("searchbox", { name: "Search the activity" }), "sync");
    expect(screen.getByText(/Sync failed/)).toBeInTheDocument();
    expect(screen.queryByText(/Risk threshold exceeded/)).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search the activity" }));
    await user.type(screen.getByRole("searchbox", { name: "Search the activity" }), "zzz");
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText('No activity matches "zzz".')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText(/Risk threshold exceeded/)).toBeInTheDocument();
  });

  it("pages the list: ten events a page, and the rest on the next one", async () => {
    const user = userEvent.setup();
    renderPage({
      ...healthy,
      listNotifications: () =>
        Promise.resolve({
          data: Array.from({ length: 12 }, (_, index) =>
            notification(`n${String(index)}`, `Alert number ${String(index)}`, index + 10),
          ),
        }),
      listTransactions: () =>
        Promise.resolve({ data: [], meta: { page: 1, pageSize: 100, total: 0 } }),
    });

    expect(await screen.findByText("Showing 1–10 of 12")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(10);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 11–12 of 12")).toBeInTheDocument();
    expect(screen.getByText(/Alert number 11/)).toBeInTheDocument();
    expect(screen.queryByText(/Alert number 0\b/)).not.toBeInTheDocument();
  });

  it("goes back to the first page when the search changes", async () => {
    const user = userEvent.setup();
    renderPage({
      ...healthy,
      listNotifications: () =>
        Promise.resolve({
          data: Array.from({ length: 12 }, (_, index) =>
            notification(`n${String(index)}`, `Alert number ${String(index)}`, index + 10),
          ),
        }),
      listTransactions: () =>
        Promise.resolve({ data: [], meta: { page: 1, pageSize: 100, total: 0 } }),
    });
    await screen.findByText("Showing 1–10 of 12");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.type(screen.getByRole("searchbox", { name: "Search the activity" }), "Alert");

    expect(screen.getByText("Showing 1–10 of 12")).toBeInTheDocument();
  });

  it("says there is no activity yet when there is nothing at all", async () => {
    renderPage({
      ...healthy,
      listNotifications: () => Promise.resolve({ data: [] }),
      listTransactions: () =>
        Promise.resolve({ data: [], meta: { page: 1, pageSize: 100, total: 0 } }),
    });

    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("says it could not load, and loads again on retry", async () => {
    const user = userEvent.setup();
    let failing = true;
    renderPage({
      ...healthy,
      listNotifications: () =>
        failing
          ? Promise.reject(new ApiError("DEPENDENCY_ERROR", "Unavailable", 503))
          : (healthy.listNotifications?.() ?? Promise.resolve({ data: [] })),
    });

    expect(await screen.findByText("Couldn't load the activity")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("3 events · last 30 days")).toBeInTheDocument();
  });

  it("opens the detail of a transaction from its row", async () => {
    const user = userEvent.setup();
    renderPage(healthy);
    await screen.findByText(/Bought AAPL/);

    await user.click(screen.getByRole("button", { name: "View transaction" }));

    const detail = await screen.findByRole("dialog");
    expect(within(detail).getByText("Transaction details")).toBeInTheDocument();
  });

  it("narrows by severity from the filters panel, shows a chip, and removes it", async () => {
    const user = userEvent.setup();
    renderPage({
      ...healthy,
      listNotifications: () =>
        Promise.resolve({
          data: [
            { ...notification("n1", "Risk threshold exceeded", 30), severity: "WARNING" },
            { ...notification("n2", "Sync failed", 60), severity: "ERROR" },
          ],
        }),
    });
    await screen.findByText(/Sync failed/);

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("checkbox", { name: "Error" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(screen.getByText(/Sync failed/)).toBeInTheDocument();
    expect(screen.queryByText(/Risk threshold exceeded/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters · 1" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Active filters" })).getByText("Severity: Error"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove filter Severity: Error" }));
    expect(screen.getByText(/Risk threshold exceeded/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Active filters" })).not.toBeInTheDocument();
  });

  it("narrows by source and clears everything from the chips row", async () => {
    const user = userEvent.setup();
    renderPage(healthy);
    await screen.findByText(/Bought AAPL/);

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("checkbox", { name: "Transaction" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(screen.getByText(/Bought AAPL/)).toBeInTheDocument();
    expect(screen.queryByText(/Risk threshold exceeded/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByText(/Risk threshold exceeded/)).toBeInTheDocument();
  });

  it("says no activity matches the filters, and clears them from there", async () => {
    const user = userEvent.setup();
    renderPage({
      ...healthy,
      listTransactions: () =>
        Promise.resolve({ data: [], meta: { page: 1, pageSize: 100, total: 0 } }),
    });
    await screen.findByText(/Risk threshold exceeded/);

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("checkbox", { name: "Transaction" }));
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(
      screen.getByText("No activity matches these filters. Review them or clear them."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText(/Risk threshold exceeded/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderPage(healthy);
    await screen.findByText("3 events · last 30 days");

    expect(await axe(container)).toHaveNoViolations();
  });
});
