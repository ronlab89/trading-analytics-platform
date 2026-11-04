import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";

const portfolio = (id: string, name: string) => ({
  id,
  userId: "u-1",
  name,
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

const position = (id: string, assetId: string) => ({
  id,
  portfolioId: "p1",
  assetId,
  quantity: 236,
  averageEntryPrice: { amount: "162.40", currency: "USD" },
  currentPrice: { amount: "180.70", currency: "USD" },
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

const asset = (id: string, symbol: string, name: string) => ({
  id,
  symbol,
  name,
  assetType: "STOCK",
  currency: "USD",
  exchange: "NASDAQ",
  status: "ACTIVE",
  metadata: {},
});

const transaction = (id: string, assetId: string) => ({
  id,
  portfolioId: "p1",
  assetId,
  type: "BUY",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  realizedPnL: null,
  status: "COMPLETED",
  executedAt: "2026-10-06T14:29:00.000Z",
  createdAt: "2026-10-06T14:29:00.000Z",
});

const usd = (amount: string) => ({ amount, currency: "USD" });

/**
 * The overview the dashboard draws from. The HTTP client checks every answer against the contract,
 * so it is a whole valid overview: five positions, today's change, and the latest five transactions.
 */
const overview = () => ({
  portfolio: portfolio("p1", "Conservador"),
  summary: {
    totalValue: usd("125430.25"),
    investedValue: usd("107230.25"),
    unrealizedPnL: usd("18200.00"),
    unrealizedPnLPercent: 17,
  },
  positions: ["a1", "a2", "a3", "a4", "a5"].map((assetId, index) => ({
    position: position(`s${String(index)}`, assetId),
    asset: {
      id: assetId,
      symbol: assetId.toUpperCase(),
      name: `Asset ${assetId}`,
      assetType: "STOCK",
    },
    metrics: {
      marketValue: usd("25086.00"),
      costBasis: usd("21446.00"),
      unrealizedPnL: usd("3640.00"),
      unrealizedPnLPercent: 17,
    },
    allocationPercent: 20,
    dailyChange: {
      changeValue: usd("468.02"),
      changePercent: [3.8, 2.1, 1.2, -0.6, -1.4][index] ?? 0,
    },
  })),
  allocation: {
    groupBy: "asset",
    groups: ["a1", "a2", "a3", "a4", "a5"].map((assetId, index) => ({
      key: assetId,
      label: assetId.toUpperCase(),
      marketValue: usd(String(25000 - index * 2000) + ".00"),
      percentage: 30 - index * 5,
    })),
  },
  attribution: { totalUnrealizedPnL: usd("18200.00"), items: [] },
  recentTransactions: ["a1", "a2", "a3", "a4", "a5"].map((assetId, index) => ({
    transaction: transaction(`t${String(index)}`, assetId),
    asset: {
      id: assetId,
      symbol: assetId.toUpperCase(),
      name: `Asset ${assetId.toUpperCase()}`,
      assetType: "STOCK",
    },
  })),
  dailyChange: { changeValue: usd("2340.10"), changePercent: 1.9, excludedAssetIds: [] },
  performance: {
    asOf: "2026-10-05",
    effectiveFrom: "2026-10-01",
    status: "OK",
    twrPercent: 6.12,
    pnl: usd("7300.00"),
    series: [],
  },
  pulse: {
    performance: { classification: "POSITIVE", value: 17, explanation: "Up 17 % on cost." },
    concentration: { classification: "LOW", value: 20, explanation: "Spread over five assets." },
    volatility: { classification: "MODERATE", value: 14.2, explanation: "14.2 % over 30 days." },
    drawdown: { classification: "LOW", value: 2, explanation: "2 % below the peak." },
  },
  whatChanged: {
    asOf: "2026-10-05",
    effectiveFrom: "2026-10-01",
    status: "OK",
    contributor: null,
    detractor: null,
    events: [],
  },
});

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

const MOBILE_MAX = 560;

const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "Access-Control-Allow-Origin": "http://localhost:4173",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify({ data }),
});

/**
 * The performance the charts draw from: 40 business days across three months, each with a value
 * and a daily return that goes up and down, so the bars have both colors.
 */
const performance = () => {
  const series = [];
  const day = new Date(Date.UTC(2026, 7, 17));
  for (let i = 0; series.length < 40; i += 1) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    series.push({
      date: day.toISOString().slice(0, 10),
      value: { amount: (120000 + i * 150).toFixed(2), currency: "USD" },
      returnPercent: i % 3 === 0 ? -0.6 : 0.5,
    });
  }
  return {
    asOf: "2026-10-06",
    effectiveFrom: "2026-08-18",
    status: "OK",
    twrPercent: 4,
    pnl: { amount: "5000.00", currency: "USD" },
    series,
  };
};

/** The portfolio list and its detail, with the names the three layouts need to show. */
test.beforeEach(async ({ page }) => {
  await mockApi(page, { refresh: signedInReply });
  await page.route("http://localhost:7001/api/v1/portfolios", (route) =>
    route.fulfill(
      json([
        portfolio("p1", "Conservador"),
        portfolio("p2", "Crecimiento"),
        ...Array.from({ length: 12 }, (_, i) => portfolio(`x${String(i)}`, `Extra ${String(i)}`)),
      ]),
    ),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1", (route) =>
    route.fulfill(json(portfolio("p1", "Conservador"))),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/positions", (route) =>
    route.fulfill(
      json([
        position("s1", "a1"),
        position("s2", "a2"),
        position("s3", "a3"),
        position("s4", "a4"),
        position("s5", "a5"),
      ]),
    ),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/transactions?*", (route) =>
    route.fulfill({
      ...json(null),
      body: JSON.stringify({
        data: [
          transaction("t1", "a1"),
          transaction("t2", "a2"),
          transaction("t3", "a3"),
          transaction("t4", "a4"),
          transaction("t5", "a5"),
        ],
        meta: { page: 1, pageSize: 10, total: 48, totalPages: 5 },
      }),
    }),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/overview", (route) =>
    route.fulfill(json(overview())),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/analytics/performance?*", (route) =>
    route.fulfill(json(performance())),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/analytics/risk?*", (route) =>
    route.fulfill(
      json({
        asOf: "2026-10-14",
        effectiveFrom: "2026-09-14",
        status: "OK",
        volatilityPercent: 14.2,
        maxDrawdownPercent: -8.4,
        currentDrawdownPercent: -1,
        peakDate: "2026-09-10",
        troughDate: "2026-09-22",
      }),
    ),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/analytics/allocation?*", (route) =>
    route.fulfill(
      json({
        groupBy: "asset",
        groups: [
          { key: "a1", label: "AAPL", marketValue: usd("42646.00"), percentage: 34 },
          { key: "a2", label: "MSFT", marketValue: usd("27595.00"), percentage: 22 },
        ],
      }),
    ),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/analytics/attribution?*", (route) =>
    route.fulfill(
      json({
        asOf: "2026-10-14",
        effectiveFrom: "2026-09-14",
        status: "OK",
        groupBy: "asset",
        pnl: usd("2500.00"),
        groups: [
          { key: "a1", label: "AAPL", contribution: usd("4300.00") },
          { key: "a2", label: "MSFT", contribution: usd("-700.00") },
        ],
      }),
    ),
  );
  await page.route("http://localhost:7001/api/v1/notifications*", (route) =>
    route.fulfill(
      json(
        [
          ["n1", "WARNING", "Risk threshold exceeded"],
          ["n2", "INFO", "Pending purchase of AAPL"],
          ["n3", "SUCCESS", "Rebalance applied"],
        ].map(([id, severity, title], index) => ({
          id,
          userId: "u1",
          type: "TEST",
          title,
          message: "Message",
          severity,
          readAt: null,
          createdAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
          metadata: {},
        })),
      ),
    ),
  );
  await page.route("http://localhost:7001/api/v1/watchlist", (route) =>
    route.fulfill(
      json(
        ["a1", "a2", "a3", "a4", "a5"].map((assetId) => ({
          id: `w-${assetId}`,
          userId: "u-1",
          assetId,
          createdAt: "2026-11-01T10:00:00.000Z",
        })),
      ),
    ),
  );
  await page.route("http://localhost:7001/api/v1/market/prices?*", (route) =>
    route.fulfill(
      json(
        ["a1", "a2", "a3", "a4", "a5"].map((assetId, index) => ({
          assetId,
          price: usd("180.70"),
          previousPrice: usd("177.00"),
          change: usd("3.70"),
          changePercent: index % 2 === 0 ? 2.1 : -0.6,
          timestamp: "2026-11-03T14:32:07.000Z",
          source: "SIMULATED",
        })),
      ),
    ),
  );
  await page.route("http://localhost:7001/api/v1/portfolios/p1/decisions*", (route) =>
    route.fulfill(
      json(
        [
          { id: "d1", assetId: "a1", title: "Buy the dip", closedAt: null, outcome: null },
          {
            id: "d2",
            assetId: "a2",
            title: "Cut the loss",
            closedAt: "2026-06-20T14:00:00.000Z",
            outcome: "Stop reached",
          },
          { id: "d3", assetId: "a3", title: "Wait and see", closedAt: null, outcome: null },
        ].map((decision) => ({
          portfolioId: "p1",
          thesis: "A thesis.",
          direction: "LONG",
          entryPrice: usd("150.00"),
          targetPrice: usd("170.00"),
          stopPrice: usd("140.00"),
          riskLevel: null,
          createdAt: "2026-06-01T14:00:00.000Z",
          notes: null,
          ...decision,
        })),
      ),
    ),
  );
  await page.route("http://localhost:7001/api/v1/decisions/d1/replay", (route) =>
    route.fulfill(
      json({
        decision: {
          id: "d1",
          portfolioId: "p1",
          assetId: "a1",
          title: "Buy the dip",
          thesis: "Services keep growing and the results should beat the forecast.",
          direction: "LONG",
          entryPrice: usd("162.40"),
          targetPrice: usd("190.00"),
          stopPrice: usd("158.00"),
          riskLevel: "MODERATE",
          createdAt: "2026-08-12T10:05:00.000Z",
          closedAt: null,
          outcome: null,
          notes: "Review the stop above $170.",
        },
        events: [
          {
            id: "e1",
            decisionId: "d1",
            timestamp: "2026-08-12T10:05:00.000Z",
            type: "DECISION_CREATED",
            payload: {},
          },
          {
            id: "e2",
            decisionId: "d1",
            timestamp: "2026-08-14T15:40:00.000Z",
            type: "POSITION_OPENED",
            payload: { quantity: "236", price: "162.40" },
          },
          {
            id: "e3",
            decisionId: "d1",
            timestamp: "2026-08-28T09:30:00.000Z",
            type: "RISK_CHANGED",
            payload: { riskLevel: "HIGH" },
          },
        ],
        currency: "USD",
        initialState: {
          currentIndex: -1,
          totalEvents: 3,
          currentEvent: null,
          phase: "PLANNED",
          thesis: null,
          riskLevel: null,
          notes: [],
          position: null,
          lastPrice: null,
          unrealizedPnL: null,
          realizedPnL: null,
          issues: [],
        },
      }),
    ),
  );
  await page.route("http://localhost:7001/api/v1/assets?*", (route) =>
    route.fulfill({
      ...json(null),
      body: JSON.stringify({
        data: ["a1", "a2", "a3", "a4", "a5", "a6"].map((id) =>
          asset(id, id.toUpperCase(), `Asset ${id.toUpperCase()}`),
        ),
        meta: { page: 1, pageSize: 10, total: 24, totalPages: 3 },
      }),
    }),
  );
  await page.route("http://localhost:7001/api/v1/assets/a1/history?*", (route) =>
    route.fulfill(
      json(
        [
          ["2026-08-12", "158.20"],
          ["2026-08-14", "162.40"],
          ["2026-08-19", "160.10"],
          ["2026-08-24", "166.30"],
          ["2026-08-28", "173.50"],
          ["2026-09-09", "171.00"],
          ["2026-09-22", "178.40"],
          ["2026-10-06", "180.70"],
        ].map(([day, close]) => ({
          assetId: "a1",
          timestamp: `${String(day)}T00:00:00.000Z`,
          open: usd(String(close)),
          high: usd(String(close)),
          low: usd(String(close)),
          close: usd(String(close)),
          volume: 1000,
        })),
      ),
    ),
  );
  await page.route("http://localhost:7001/api/v1/assets/*", (route) => {
    const id = route.request().url().split("/").pop() ?? "a1";
    return route.fulfill(json(asset(id, id.toUpperCase(), `Asset ${id.toUpperCase()}`)));
  });
});

/** The list of portfolios is a table from the tablet width and a list of cards on mobile. */
async function waitForPortfolios(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: /Portfolios|Portafolios/ }).waitFor();
}

async function waitForPositions(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: /Positions|Posiciones/ }).waitFor();
}

async function waitForTransactions(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: /Transactions|Transacciones/ }).waitFor();
}

async function waitForCatalog(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: "All assets" }).waitFor();
}

async function waitForDecisions(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: "Decisions" }).waitFor();
}

async function waitForWatchlist(page: Page, width: number) {
  const role = width <= MOBILE_MAX ? "list" : "table";
  await page.getByRole(role, { name: "Watchlist" }).waitFor();
}

/** The box of something that must be on screen; a missing one fails the test with a clear reason. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${locator.toString()} is not on screen`);
  }
  return box;
}

const pageSize = (page: Page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

for (const { name, width, height } of viewports) {
  test(`the page does not scroll by itself on ${name}: only the routed view scrolls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/portfolios");
    await waitForPortfolios(page, width);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the portfolio detail does not scroll by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/portfolios/p1");
    await waitForPositions(page, width);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the transactions do not scroll the page by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the watchlist does not scroll the page by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/markets");
    await waitForWatchlist(page, width);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the catalog does not scroll the page by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/markets?tab=all");
    await waitForCatalog(page, width);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the analytics do not scroll the page by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/analytics");
    await page.getByRole("region", { name: "Period return" }).getByText("+4.00%").waitFor();

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`opening the portfolio selector does not move the layout on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/portfolios");
    await waitForPortfolios(page, width);
    const main = page.locator("main");
    const before = await main.boundingBox();

    await page.getByRole("button", { name: /Select portfolio|Seleccionar portafolio/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();

    expect(await main.boundingBox()).toEqual(before);
  });
}

test("on mobile the watchlist is a card list inside the main area, not a table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/markets");
  await waitForWatchlist(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Watchlist" }).getByRole("listitem")).toHaveCount(5);
  const main = await boxOf(page.locator("main"));
  const list = await boxOf(page.getByRole("list", { name: "Watchlist" }));
  expect(list.x).toBeGreaterThanOrEqual(main.x);
  expect(list.x + list.width).toBeLessThanOrEqual(main.x + main.width);
});

test("on tablet and desktop the watchlist shows every column", async ({ page }) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/markets");
    await waitForWatchlist(page, width);

    const headers = page.getByRole("table", { name: "Watchlist" }).getByRole("columnheader");
    await expect(headers.filter({ hasText: "Type" })).toBeVisible();
    await expect(headers.filter({ hasText: "Exchange" })).toBeVisible();
    await expect(headers.filter({ hasText: "Price" })).toBeVisible();
    await expect(headers.filter({ hasText: "Change today" })).toBeVisible();
  }
});

test("on mobile the catalog is a card list inside the main area, not a table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/markets?tab=all");
  await waitForCatalog(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "All assets" }).getByRole("listitem")).toHaveCount(6);
  const main = await boxOf(page.locator("main"));
  const list = await boxOf(page.getByRole("list", { name: "All assets" }));
  expect(list.x).toBeGreaterThanOrEqual(main.x);
  expect(list.x + list.width).toBeLessThanOrEqual(main.x + main.width);
  const search = await boxOf(page.getByRole("searchbox", { name: "Search by symbol or name" }));
  expect(search.x + search.width).toBeLessThanOrEqual(main.x + main.width);
});

test("on tablet and desktop the catalog shows every column and the filters open", async ({
  page,
}) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/markets?tab=all");
    await waitForCatalog(page, width);

    const headers = page.getByRole("table", { name: "All assets" }).getByRole("columnheader");
    await expect(headers.filter({ hasText: "Type" })).toBeVisible();
    await expect(headers.filter({ hasText: "Exchange" })).toBeVisible();
    await expect(headers.filter({ hasText: "Price" })).toBeVisible();
    await expect(headers.filter({ hasText: "Change today" })).toBeVisible();

    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByRole("checkbox", { name: "NYSE Arca" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  }
});

test("on mobile the analytics show the title, the selector and the indicators two by two", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/analytics");
  await page.getByRole("region", { name: "Period return" }).getByText("+4.00%").waitFor();

  await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
  await expect(page.getByText(/^Summary of /)).toHaveCount(0);
  const main = await boxOf(page.locator("main"));
  const selector = await boxOf(page.getByRole("group", { name: "Period" }));
  expect(selector.x).toBeGreaterThanOrEqual(main.x);
  expect(selector.x + selector.width).toBeLessThanOrEqual(main.x + main.width);
  const first = await boxOf(page.getByRole("region", { name: "Period return" }));
  const second = await boxOf(page.getByRole("region", { name: "Volatility" }));
  const third = await boxOf(page.getByRole("region", { name: "Maximum drawdown" }));
  expect(second.y).toBeCloseTo(first.y, 0);
  expect(third.y).toBeGreaterThan(first.y);
  expect(third.x).toBeCloseTo(first.x, 0);
});

test("the value and drawdown panels draw their charts inside the main area on every width", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/analytics");
    const value = page.getByRole("region", { name: "Portfolio value", exact: true });
    const drawdown = page.getByRole("region", { name: "Drawdown", exact: true });
    await expect(value.getByRole("img", { name: /Portfolio value over/ })).toBeVisible();
    await expect(drawdown.getByRole("img", { name: /Drawdown of the portfolio/ })).toBeVisible();

    const main = await boxOf(page.locator("main"));
    for (const panel of [value, drawdown]) {
      const box = await boxOf(panel);
      expect(box.x).toBeGreaterThanOrEqual(main.x);
      expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    }
  }
});

test("the allocation sits beside the value on desktop and under it on tablet and mobile", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/analytics");
    const value = page.getByRole("region", { name: "Portfolio value", exact: true });
    const allocation = page.getByRole("region", { name: "Allocation", exact: true });
    await expect(allocation.getByText("AAPL")).toBeVisible();
    await expect(allocation.getByRole("tab", { name: "Asset" })).toBeVisible();

    const main = await boxOf(page.locator("main"));
    const valueBox = await boxOf(value);
    const box = await boxOf(allocation);
    expect(box.x).toBeGreaterThanOrEqual(main.x);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    if (width >= 1280) {
      expect(box.x).toBeGreaterThanOrEqual(valueBox.x + valueBox.width);
      expect(Math.abs(box.y - valueBox.y)).toBeLessThan(2);
    } else {
      expect(box.y).toBeGreaterThanOrEqual(valueBox.y + valueBox.height);
      expect(Math.abs(box.x - valueBox.x)).toBeLessThan(2);
    }
  }
});

test("the attribution sits beside the drawdown on desktop and under it on tablet and mobile", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/analytics");
    const drawdown = page.getByRole("region", { name: "Drawdown", exact: true });
    const attribution = page.getByRole("region", { name: "Performance attribution" });
    const table = attribution.getByRole("table");
    await expect(table.getByRole("cell", { name: "AAPL" })).toBeVisible();
    await expect(table.getByText("+$4,300.00")).toBeVisible();
    await expect(table.getByText("-$700.00")).toBeVisible();

    const main = await boxOf(page.locator("main"));
    const drawdownBox = await boxOf(drawdown);
    const box = await boxOf(attribution);
    const tableBox = await boxOf(table);
    expect(box.x).toBeGreaterThanOrEqual(main.x);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(box.x + box.width);
    if (width >= 1280) {
      expect(drawdownBox.x).toBeGreaterThanOrEqual(box.x + box.width);
      expect(Math.abs(box.y - drawdownBox.y)).toBeLessThan(2);
    } else {
      expect(drawdownBox.y).toBeGreaterThanOrEqual(box.y + box.height);
      expect(Math.abs(box.x - drawdownBox.x)).toBeLessThan(2);
    }
  }
});

test("on tablet and desktop the decisions are a table inside the main area, with the prices from the desktop", async ({
  page,
}) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/decisions");
    await waitForDecisions(page, width);

    const table = page.getByRole("table", { name: "Decisions" });
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByText("Stop reached")).toBeVisible();
    const main = await boxOf(page.locator("main"));
    const box = await boxOf(table);
    expect(box.x).toBeGreaterThanOrEqual(main.x);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    await expect(table.getByRole("columnheader", { name: "Entry" })).toBeVisible({
      visible: width >= 1280,
    });
  }
});

test("on mobile the decisions are a card list inside the main area, not a table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/decisions");
  await waitForDecisions(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Decisions" }).getByRole("listitem")).toHaveCount(3);
  const main = await boxOf(page.locator("main"));
  const list = await boxOf(page.getByRole("list", { name: "Decisions" }));
  const search = await boxOf(page.getByRole("searchbox", { name: "Search decisions" }));
  for (const box of [list, search]) {
    expect(box.x).toBeGreaterThanOrEqual(main.x);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
  }
});

test("the search narrows the decisions by title, symbol or asset name", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/decisions");
  await waitForDecisions(page, 1280);

  await page.getByRole("searchbox", { name: "Search decisions" }).fill("asset a2");

  await expect(page.getByRole("table", { name: "Decisions" }).getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("row", { name: /Cut the loss/ })).toBeVisible();
});

test("the decision detail lays out its indicators, thesis and events inside the main area on every width", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/decisions/d1");
    await page.getByRole("region", { name: "Entry", exact: true }).waitFor();

    const main = await boxOf(page.locator("main"));
    const boxes = [];
    for (const name of ["Entry", "Target", "Stop", "Current return"]) {
      boxes.push(await boxOf(page.getByRole("region", { name, exact: true })));
    }
    const thesis = await boxOf(page.getByRole("region", { name: "Thesis and context" }));
    const events = await boxOf(page.getByRole("region", { name: "Position evolution" }));
    const price = await boxOf(page.getByRole("region", { name: "A1 price" }));
    await page.getByRole("img", { name: "A1 price" }).locator("svg").first().waitFor();
    for (const box of [...boxes, thesis, events, price]) {
      expect(box.x).toBeGreaterThanOrEqual(main.x);
      expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    }

    const [entry, target] = boxes;
    if (width >= 1280) {
      // Four indicators on one row, the price beside the events, the thesis under them.
      expect(Math.abs((entry?.y ?? 0) - (target?.y ?? 99))).toBeLessThan(2);
      expect(Math.abs((boxes[3]?.y ?? 99) - (entry?.y ?? 0))).toBeLessThan(2);
      expect(events.x).toBeGreaterThanOrEqual(price.x + price.width);
      expect(Math.abs(events.y - price.y)).toBeLessThan(2);
    } else {
      // Two by two, then one under the other: the price, the events, the thesis.
      expect(Math.abs((boxes[2]?.y ?? 0) - (entry?.y ?? 99))).toBeGreaterThan(20);
      expect(events.y).toBeGreaterThanOrEqual(price.y + price.height);
    }
    expect(thesis.y).toBeGreaterThanOrEqual(events.y + events.height);
    await expect(page.getByText("236 units at $162.40")).toBeVisible();
  }
});

test("the decision replay fits on every width and moves the events with its controls", async ({
  page,
}) => {
  test.slow();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/decisions/d1");
    const bar = page.getByRole("progressbar", { name: "Replay progress" });
    await bar.waitFor();

    const main = await boxOf(page.locator("main"));
    const panel = await boxOf(page.getByRole("region", { name: "Replay", exact: true }));
    expect(panel.x).toBeGreaterThanOrEqual(main.x);
    expect(panel.x + panel.width).toBeLessThanOrEqual(main.x + main.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const barBox = await boxOf(bar);
    const restart = await boxOf(page.getByRole("button", { name: "Replay from the start" }));
    if (width <= MOBILE_MAX) {
      // The line on its own row, the larger buttons under it.
      expect(restart.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
      expect(restart.width).toBe(40);
    } else {
      // One row: the buttons, then the line.
      expect(barBox.x).toBeGreaterThanOrEqual(restart.x + restart.width);
      expect(restart.width).toBe(32);
    }

    const current = page.locator('li[aria-current="step"]');
    await expect(current).toContainText("Risk changed");
    await page.getByRole("button", { name: "Previous event" }).click();
    await expect(current).toContainText("Position opened");
    await expect(bar).toHaveAttribute("aria-valuenow", "2");

    await page.getByRole("button", { name: "2×" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(current).toContainText("Risk changed");
    await expect(page.getByRole("button", { name: "Replay from the start" })).toBeVisible();
  }
});

test("on mobile the custom period is a bottom sheet with one month", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analytics");
  await page.getByRole("region", { name: "Period return" }).getByText("+4.00%").waitFor();

  await page.getByRole("button", { name: "Custom" }).click();

  const sheet = page.getByRole("dialog", { name: "Choose a period" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("grid")).toHaveCount(1);
  // The sheet slides in, so its bottom edge settles on the bottom of the screen.
  await expect
    .poll(async () => {
      const box = await boxOf(sheet);
      return box.y + box.height;
    })
    .toBeCloseTo(844, 0);
  expect((await boxOf(sheet)).width).toBe(390);
});

test("on tablet and desktop the analytics show four indicators and the custom period opens", async ({
  page,
}) => {
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/analytics");
    await page.getByRole("region", { name: "Period return" }).getByText("+4.00%").waitFor();

    await expect(page.getByText("Summary of Conservador · 5 positions")).toBeVisible();
    for (const name of ["Period return", "Volatility", "Maximum drawdown", "Concentration"]) {
      await expect(page.getByRole("region", { name })).toBeVisible();
    }
    await page.getByRole("button", { name: "Custom" }).click();
    await expect(page.getByRole("button", { name: "Last 7 days" })).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(width >= 901 ? 2 : 1);
    await page.getByRole("button", { name: "Cancel" }).click();
  }
});

test("on mobile the portfolios are cards inside the main area, not a table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/portfolios");
  await waitForPortfolios(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  const main = await boxOf(page.locator("main"));
  const card = await boxOf(page.getByRole("listitem").first());
  expect(card.x).toBeGreaterThanOrEqual(main.x);
  expect(card.x + card.width).toBeLessThanOrEqual(main.x + main.width);
});

test("on mobile the create form is a bottom sheet as wide as the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portfolios");
  await waitForPortfolios(page, 390);

  await page.getByRole("button", { name: /^(New|Nuevo)$/ }).click();

  const dialog = page.getByRole("dialog");
  const box = await boxOf(dialog);
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  // The sheet slides up from the bottom edge, so wait for it to settle there.
  await expect
    .poll(async () => {
      const settled = await boxOf(dialog);
      return settled.y + settled.height;
    })
    .toBe(844);
});

test("on tablet and desktop the create form is a centered dialog, not a sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/portfolios");
  await waitForPortfolios(page, 768);

  await page.getByRole("button", { name: /New portfolio|Nuevo portafolio/ }).click();

  const box = await boxOf(page.getByRole("dialog"));
  expect(box.x).toBeGreaterThan(0);
  expect(box.x + box.width).toBeLessThan(768);
});

test("on mobile the new transaction panel is a bottom sheet as wide as the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await waitForTransactions(page, 390);

  await page.getByRole("button", { name: /^(New|Nueva)$/ }).click();

  const dialog = page.getByRole("dialog", { name: /New transaction|Nueva transacción/ });
  const box = await boxOf(dialog);
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  // The sheet slides up from the bottom edge, so wait for it to settle there.
  await expect
    .poll(async () => {
      const settled = await boxOf(dialog);
      return settled.y + settled.height;
    })
    .toBe(844);
});

for (const { name, width, height } of viewports.filter((viewport) => viewport.width > MOBILE_MAX)) {
  test(`on ${name} the new transaction panel is a 440 px drawer at the right, as tall as the screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);

    await page.getByRole("button", { name: /New transaction|Nueva transacción/ }).click();

    const dialog = page.getByRole("dialog", { name: /New transaction|Nueva transacción/ });
    // The drawer slides in from the right edge, so wait for it to settle there.
    await expect
      .poll(async () => {
        const settled = await boxOf(dialog);
        return settled.x + settled.width;
      })
      .toBe(width);
    const box = await boxOf(dialog);
    expect(box.width).toBe(440);
    expect(box.y).toBe(0);
    expect(box.height).toBe(height);
  });
}

const detailName = /Transaction details|Detalle de la transacción/;

test("on mobile tapping a transaction opens its detail as a bottom sheet as wide as the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await waitForTransactions(page, 390);

  await page
    .getByRole("button", { name: /View the .* transaction|Ver la transacción de/ })
    .first()
    .click();

  const sheet = page.getByRole("dialog", { name: detailName });
  const box = await boxOf(sheet);
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  // The sheet slides up from the bottom edge, so wait for it to settle there.
  await expect
    .poll(async () => {
      const settled = await boxOf(sheet);
      return settled.y + settled.height;
    })
    .toBe(844);
});

for (const { name, width, height } of viewports.filter((viewport) => viewport.width > MOBILE_MAX)) {
  test(`on ${name} the row menu opens the transaction detail in a 440 px drawer at the right`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);

    await page
      .getByRole("button", { name: /Actions for the|Acciones de la transacción/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /View details|Ver detalle/ }).click();

    const dialog = page.getByRole("dialog", { name: detailName });
    // The drawer slides in from the right edge, so wait for it to settle there.
    await expect
      .poll(async () => {
        const settled = await boxOf(dialog);
        return settled.x + settled.width;
      })
      .toBe(width);
    const box = await boxOf(dialog);
    expect(box.width).toBe(440);
    expect(box.y).toBe(0);
    expect(box.height).toBe(height);
  });
}

const filtersButton = (page: Page) =>
  page.getByRole("button", { name: /^(Filters|Filtros)( · \d+)?$/ });

test("on mobile the transaction filters are a bottom sheet as wide as the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await waitForTransactions(page, 390);

  await filtersButton(page).click();

  const sheet = page.getByRole("dialog", { name: /Filters|Filtros/ });
  const box = await boxOf(sheet);
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  // The sheet slides up from the bottom edge, so wait for it to settle there.
  await expect
    .poll(async () => {
      const settled = await boxOf(sheet);
      return settled.y + settled.height;
    })
    .toBe(844);
});

for (const { name, width, height } of viewports.filter((viewport) => viewport.width > MOBILE_MAX)) {
  test(`on ${name} the transaction filters are a 400 px panel under the button, inside the screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);

    await filtersButton(page).click();

    const panel = page.getByRole("dialog", { name: /Filters|Filtros/ });
    const box = await boxOf(panel);
    const button = await boxOf(filtersButton(page));
    expect(box.width).toBe(400);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(button.y + button.height);
  });
}

for (const { name, width, height } of viewports) {
  test(`the date range calendar fits inside the screen on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);
    await filtersButton(page).click();

    await page.getByRole("button", { name: /^(Date|Fecha)/ }).click();

    // The calendar is the last dialog opened: it sits in a layer over the filters.
    const calendar = page.getByRole("dialog").last();
    await expect(
      calendar.getByRole("button", { name: /^(Last 7 days|Últimos 7 días)$/ }),
    ).toBeVisible();
    const box = await boxOf(calendar);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
  });

  test(`applying a type filter asks the API for it and shows its chip on ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/transactions");
    await waitForTransactions(page, width);
    await filtersButton(page).click();

    await page.getByRole("checkbox", { name: /^(Sell|Venta)$/ }).click();
    const filtered = page.waitForRequest(
      (request) =>
        request.url().includes("/portfolios/p1/transactions") &&
        request.url().includes("type=SELL"),
    );
    await page.getByRole("button", { name: /^(Apply filters|Aplicar filtros)$/ }).click();
    await filtered;

    await expect(page.getByText(/^(Type: Sell|Tipo: Venta)$/)).toBeVisible();
    await expect(filtersButton(page)).toHaveText(/(Filters|Filtros) · 1/);
    const size = await pageSize(page);
    expect(size.scrollWidth).toBe(size.clientWidth);
  });
}

test("on mobile the transactions are rows of one card inside the main area, not a table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/transactions");
  await waitForTransactions(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  const main = await boxOf(page.locator("main"));
  const list = await boxOf(page.getByRole("list", { name: /Transactions|Transacciones/ }));
  expect(list.x).toBeGreaterThanOrEqual(main.x);
  expect(list.x + list.width).toBeLessThanOrEqual(main.x + main.width);
});

test("the tablet drops quantity, price and fees, and the desktop shows them", async ({ page }) => {
  const dropped = /^(Quantity|Cantidad|Price|Precio|Fees|Comisión)$/;

  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/transactions");
  await waitForTransactions(page, 768);
  await expect(page.getByRole("columnheader", { name: dropped })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("columnheader", { name: dropped })).toHaveCount(3);
});

test("the pagination writes the page on the tablet and numbers the pages on the desktop", async ({
  page,
}) => {
  const pageOf = page.getByText(/Page 1 of 5|Página 1 de 5/);
  const numbered = page.getByRole("button", { name: /^(Page|Página) 5$/ });

  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/transactions");
  await waitForTransactions(page, 768);
  await expect(pageOf).toBeVisible();
  await expect(numbered).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(pageOf).toBeHidden();
  await expect(numbered).toBeVisible();
});

test("on mobile the positions are cards and the detail header keeps its actions in one row", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/portfolios/p1");
  await waitForPositions(page, 390);

  await expect(page.getByRole("table")).toHaveCount(0);
  const back = await boxOf(
    page.getByRole("link", { name: /Back to Portfolios|Volver a Portafolios/ }),
  );
  const actions = await boxOf(
    page.getByRole("button", { name: /Portfolio actions|Acciones del portafolio/ }),
  );
  expect(Math.abs(back.y - actions.y)).toBeLessThan(back.height + actions.height);
  expect(actions.x + actions.width).toBeLessThanOrEqual(390);
});

const recentTransactions = (page: Page) =>
  page.getByRole("region", { name: /Recent transactions|Transacciones recientes/ });

const performancePanel = (page: Page) =>
  page.getByRole("region", { name: /^(Performance|Rendimiento)$/ });
const dailyReturns = (page: Page) =>
  page.getByRole("region", { name: /Daily performance|Rendimiento diario/ });

const distribution = (page: Page) =>
  page.getByRole("region", { name: /^(Distribution|Distribución)$/ });
const attention = (page: Page) =>
  page.getByRole("region", { name: /Needs attention|Requiere atención/ });
const riskLevel = (page: Page) => page.getByRole("region", { name: /Risk level|Nivel de riesgo/ });
const movers = (page: Page) => page.getByRole("region", { name: /Top movers|Mayores movimientos/ });

async function waitForDashboard(page: Page) {
  await recentTransactions(page).waitFor();
  await performancePanel(page).locator(".recharts-surface").waitFor();
  await dailyReturns(page).locator(".recharts-surface").waitFor();
  await distribution(page).locator(".recharts-surface").waitFor();
  await attention(page).getByRole("listitem").first().waitFor();
  await page.getByRole("list", { name: /last months|últimos meses/ }).waitFor();
}

for (const { name, width, height } of viewports) {
  test(`the dashboard does not scroll the page by itself on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await waitForDashboard(page);

    const size = await pageSize(page);

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`the dashboard panels stay inside the main area on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await waitForDashboard(page);

    const main = await boxOf(page.locator("main"));
    const regions = await page.locator("main").getByRole("region").all();
    expect(regions).toHaveLength(9);
    for (const region of regions) {
      const box = await boxOf(region);
      expect(box.x).toBeGreaterThanOrEqual(main.x);
      expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    }
  });
}

test("on the desktop the total return, the risk level and the distribution share a row, below it they stack", async ({
  page,
}) => {
  const value = page.getByRole("region", { name: /^(Hello|Hola)/ });
  const totalReturn = page.getByRole("region", { name: /Total return|Retorno total/ });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  const row = {
    value: await boxOf(value),
    totalReturn: await boxOf(totalReturn),
    risk: await boxOf(riskLevel(page)),
    distribution: await boxOf(distribution(page)),
  };
  expect(row.totalReturn.x).toBe(row.value.x);
  expect(row.totalReturn.y).toBeGreaterThanOrEqual(row.value.y + row.value.height);
  expect(row.risk.x).toBeGreaterThan(row.totalReturn.x + row.totalReturn.width - 1);
  expect(row.distribution.x).toBeGreaterThan(row.risk.x + row.risk.width - 1);
  expect(Math.abs(row.risk.y - row.totalReturn.y)).toBeLessThan(2);
  expect(Math.abs(row.distribution.y - row.totalReturn.y)).toBeLessThan(2);

  await page.setViewportSize({ width: 768, height: 800 });
  const stacked = { value: await boxOf(value), totalReturn: await boxOf(totalReturn) };
  expect(stacked.totalReturn.y).toBeGreaterThanOrEqual(stacked.value.y + stacked.value.height);
  expect(stacked.totalReturn.x).toBe(stacked.value.x);
});

test("on the desktop the recent transactions and the top movers share a row, on mobile they stack", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  const side = { recent: await boxOf(recentTransactions(page)), movers: await boxOf(movers(page)) };
  expect(side.movers.x).toBeGreaterThan(side.recent.x + side.recent.width - 1);
  expect(side.recent.width).toBeGreaterThan(side.movers.width);

  await page.setViewportSize({ width: 390, height: 800 });
  const stacked = {
    recent: await boxOf(recentTransactions(page)),
    movers: await boxOf(movers(page)),
  };
  expect(stacked.movers.y).toBeGreaterThanOrEqual(stacked.recent.y + stacked.recent.height);
});

test("on the desktop what needs attention sits beside the daily performance, on mobile below it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  const side = { daily: await boxOf(dailyReturns(page)), attention: await boxOf(attention(page)) };
  expect(side.attention.x).toBeGreaterThan(side.daily.x + side.daily.width - 1);
  expect(Math.abs(side.attention.y - side.daily.y)).toBeLessThan(2);
  await expect(attention(page).getByRole("listitem")).toHaveCount(3);

  await page.setViewportSize({ width: 390, height: 800 });
  const stacked = {
    daily: await boxOf(dailyReturns(page)),
    attention: await boxOf(attention(page)),
  };
  expect(stacked.attention.y).toBeGreaterThanOrEqual(stacked.daily.y + stacked.daily.height);
});

test("the top movers list the biggest moves first with their sign", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);

  const items = movers(page).getByRole("listitem");
  await expect(items).toHaveCount(5);
  await expect(items.first()).toContainText("A1");
  await expect(items.first()).toContainText("+3.80%");
  await expect(items.last()).toContainText("-0.60%");
});

test("the recent transactions are a table from the tablet and cards on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  await expect(recentTransactions(page).getByRole("table")).toHaveCount(0);
  await expect(recentTransactions(page).getByRole("listitem")).toHaveCount(5);

  await page.setViewportSize({ width: 768, height: 800 });
  await expect(recentTransactions(page).getByRole("table")).toHaveCount(1);
  await expect(recentTransactions(page).getByRole("row")).toHaveCount(6);
});

test("the tablet drops quantity times price from the recent transactions, the desktop shows it", async ({
  page,
}) => {
  const column = recentTransactions(page).getByRole("columnheader", {
    name: /Quantity × price|Cantidad × precio/,
  });

  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  await expect(column).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(column).toHaveCount(1);
});

test("on mobile tapping a recent transaction opens its detail as a bottom sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForDashboard(page);

  await page
    .getByRole("button", { name: /View the .* transaction|Ver la transacción de/ })
    .first()
    .click();

  const sheet = page.getByRole("dialog", { name: /Transaction details|Detalle de la transacción/ });
  const box = await boxOf(sheet);
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
});

test("on the desktop the value and the performance sit side by side, below it they stack", async ({
  page,
}) => {
  const value = page.getByRole("region", { name: /^(Hello|Hola)/ });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  const side = { value: await boxOf(value), chart: await boxOf(performancePanel(page)) };
  expect(side.chart.x).toBeGreaterThan(side.value.x + side.value.width - 1);

  await page.setViewportSize({ width: 390, height: 800 });
  const stacked = { value: await boxOf(value), chart: await boxOf(performancePanel(page)) };
  expect(stacked.chart.y).toBeGreaterThanOrEqual(stacked.value.y + stacked.value.height);
  expect(stacked.chart.x).toBe(stacked.value.x);
});

for (const { name, width, height } of viewports) {
  test(`the charts fit their panels on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await waitForDashboard(page);

    for (const panel of [performancePanel(page), dailyReturns(page), distribution(page)]) {
      const box = await boxOf(panel);
      const surface = await boxOf(panel.locator(".recharts-surface"));
      expect(surface.width).toBeGreaterThan(200);
      expect(surface.x + surface.width).toBeLessThanOrEqual(box.x + box.width);
    }
    const months = page.getByRole("list", { name: /last months|últimos meses/ });
    await expect(months.getByRole("listitem")).toHaveCount(3);
  });
}

test("picking another period asks for it and keeps the chart", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);

  const request = page.waitForRequest(
    (r) => r.url().includes("period=3M") && r.url().includes("performance"),
  );
  await performancePanel(page).getByRole("button", { name: "3M" }).click();
  await request;

  await expect(performancePanel(page).locator(".recharts-surface")).toBeVisible();
});
