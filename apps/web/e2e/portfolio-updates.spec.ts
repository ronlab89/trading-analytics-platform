import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";
import { mockRealtime, type RealtimeMock } from "./support/mock-realtime";

const API = "http://localhost:7001/api/v1";

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

const usd = (amount: string) => ({ amount, currency: "USD" });

const portfolio = {
  id: "p1",
  userId: "u-1",
  name: "Conservador",
  description: null,
  baseCurrency: "USD",
  status: "ACTIVE",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const held = {
  a1: { symbol: "AAPL", name: "Apple Inc." },
  a2: { symbol: "SPY", name: "SPDR S&P 500 ETF" },
};

const positionOf = (assetId: keyof typeof held) => ({
  id: `s-${assetId}`,
  portfolioId: "p1",
  assetId,
  quantity: 10,
  averageEntryPrice: usd("150.00"),
  currentPrice: usd("180.70"),
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

/** The overview of the portfolio holding AAPL, worth `total`. */
const overview = (total: string) => ({
  portfolio,
  summary: {
    totalValue: usd(total),
    investedValue: usd(total),
    unrealizedPnL: usd("307.00"),
    unrealizedPnLPercent: 20.5,
  },
  positions: [
    {
      position: positionOf("a1"),
      asset: { id: "a1", symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK" },
      metrics: {
        marketValue: usd(total),
        costBasis: usd("1500.00"),
        unrealizedPnL: usd("307.00"),
        unrealizedPnLPercent: 20.5,
      },
      allocationPercent: 100,
      dailyChange: null,
    },
  ],
  allocation: { groupBy: "asset", groups: [] },
  attribution: { totalUnrealizedPnL: usd("307.00"), items: [] },
  recentTransactions: [],
  dailyChange: null,
  performance: {
    asOf: "2026-10-05",
    effectiveFrom: "2026-10-01",
    status: "OK",
    twrPercent: 6.12,
    pnl: usd("307.00"),
    series: [],
  },
  pulse: {
    performance: { classification: "POSITIVE", value: 21, explanation: "Up 21 % on cost." },
    concentration: { classification: "LOW", value: 50, explanation: "Spread over one asset." },
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

/**
 * What the server holds, and how often the app asked for it. `committed` flips when a transaction
 * "commits": from then on the positions and the overview answer with the new holdings.
 */
function mockServer(page: Page) {
  const server = { committed: false, positionReads: 0, overviewReads: 0 };
  return mockApi(page, { refresh: signedInReply }).then(async () => {
    await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
    await page.route(`${API}/portfolios/p1`, (route) => route.fulfill(json(portfolio)));
    await page.route(`${API}/portfolios/p1/positions`, (route) => {
      server.positionReads += 1;
      return route.fulfill(
        json(server.committed ? [positionOf("a1"), positionOf("a2")] : [positionOf("a1")]),
      );
    });
    await page.route(`${API}/portfolios/p1/overview`, (route) => {
      server.overviewReads += 1;
      return route.fulfill(json(overview(server.committed ? "3000.00" : "1807.00")));
    });
    await page.route(`${API}/assets/*`, (route) => {
      const id = route.request().url().split("/").pop() as keyof typeof held;
      return route.fulfill(
        json({
          id,
          ...held[id],
          assetType: "STOCK",
          currency: "USD",
          exchange: "NASDAQ",
          status: "ACTIVE",
          metadata: {},
        }),
      );
    });
    return server;
  });
}

/** What the server pushes when the holdings of a portfolio change. */
const portfolioUpdated = (portfolioId: string) =>
  JSON.stringify({
    id: "e1",
    type: "PORTFOLIO_UPDATED",
    channel: `portfolio:${portfolioId}`,
    sequence: 1,
    timestamp: new Date().toISOString(),
    epoch: "epoch-1",
    payload: { portfolioId, reason: "TRANSACTION_COMMITTED" },
  });

/** The event can only arrive once the app asked for the channel. */
async function waitForSubscription(realtime: RealtimeMock, channel: string) {
  await expect
    .poll(() =>
      realtime.received.some(
        (message) => message.type === "SUBSCRIBE" && message.channel === channel,
      ),
    )
    .toBe(true);
}

async function pageSize(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

for (const { name, width, height } of viewports) {
  test.describe(`on ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
    });

    test("shows a position the portfolio gained, when the server says it changed", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      const server = await mockServer(page);
      await page.goto("/portfolios/p1");
      const role = width <= MOBILE_MAX ? "list" : "table";
      await page.getByRole(role, { name: /Positions/ }).waitFor();
      await expect(page.getByText("AAPL")).toBeVisible();
      await expect(page.getByText("SPY")).toHaveCount(0);
      await waitForSubscription(realtime, "market:a1");
      await waitForSubscription(realtime, "portfolio:p1");
      const readsBefore = server.positionReads;

      server.committed = true;
      realtime.sockets[0]?.send(portfolioUpdated("p1"));

      await expect(page.getByText("SPY")).toBeVisible();
      expect(server.positionReads).toBeGreaterThan(readsBefore);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("shows the new value on the dashboard, when the server says the portfolio changed", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      const server = await mockServer(page);
      await page.goto("/");
      await expect(page.getByText("$1,807.00").first()).toBeVisible();
      await waitForSubscription(realtime, "portfolio:p1");

      server.committed = true;
      realtime.sockets[0]?.send(portfolioUpdated("p1"));

      await expect(page.getByText("$3,000.00").first()).toBeVisible();
      await expect(page.getByText("$1,807.00")).toHaveCount(0);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("does not read anything again for an event of another portfolio", async ({ page }) => {
      const realtime = await mockRealtime(page);
      const server = await mockServer(page);
      await page.goto("/");
      await expect(page.getByText("$1,807.00").first()).toBeVisible();
      await waitForSubscription(realtime, "portfolio:p1");
      const readsBefore = server.overviewReads;

      server.committed = true;
      realtime.sockets[0]?.send(portfolioUpdated("p2"));

      await page.waitForTimeout(500);
      expect(server.overviewReads).toBe(readsBefore);
      await expect(page.getByText("$1,807.00").first()).toBeVisible();
    });
  });
}
