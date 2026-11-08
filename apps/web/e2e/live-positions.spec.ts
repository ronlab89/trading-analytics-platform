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

// AAPL: 10 at 150 now 180.70; SPY: 5 at 40 now 50. The overview sums them: 1807 + 250 = 2057.
const held = {
  a1: { symbol: "AAPL", name: "Apple Inc.", quantity: 10, average: "150.00", price: "180.70" },
  a2: { symbol: "SPY", name: "SPDR S&P 500 ETF", quantity: 5, average: "40.00", price: "50.00" },
};

const positionOf = (assetId: keyof typeof held) => ({
  id: `s-${assetId}`,
  portfolioId: "p1",
  assetId,
  quantity: held[assetId].quantity,
  averageEntryPrice: usd(held[assetId].average),
  currentPrice: usd(held[assetId].price),
  openedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

const overview = () => ({
  portfolio,
  summary: {
    totalValue: usd("2057.00"),
    investedValue: usd("2057.00"),
    unrealizedPnL: usd("357.00"),
    unrealizedPnLPercent: 21,
  },
  positions: (Object.keys(held) as (keyof typeof held)[]).map((assetId) => ({
    position: positionOf(assetId),
    asset: {
      id: assetId,
      symbol: held[assetId].symbol,
      name: held[assetId].name,
      assetType: "STOCK",
    },
    metrics: {
      marketValue: usd("1807.00"),
      costBasis: usd("1500.00"),
      unrealizedPnL: usd("307.00"),
      unrealizedPnLPercent: 20.5,
    },
    allocationPercent: 50,
    dailyChange: null,
  })),
  allocation: { groupBy: "asset", groups: [] },
  attribution: { totalUnrealizedPnL: usd("357.00"), items: [] },
  recentTransactions: [],
  dailyChange: null,
  performance: {
    asOf: "2026-10-05",
    effectiveFrom: "2026-10-01",
    status: "OK",
    twrPercent: 6.12,
    pnl: usd("357.00"),
    series: [],
  },
  pulse: {
    performance: { classification: "POSITIVE", value: 21, explanation: "Up 21 % on cost." },
    concentration: { classification: "LOW", value: 50, explanation: "Spread over two assets." },
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

async function mockPortfolio(page: Page) {
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/portfolios/p1`, (route) => route.fulfill(json(portfolio)));
  await page.route(`${API}/portfolios/p1/positions`, (route) =>
    route.fulfill(json([positionOf("a1"), positionOf("a2")])),
  );
  await page.route(`${API}/portfolios/p1/overview`, (route) => route.fulfill(json(overview())));
  await page.route(`${API}/assets/*`, (route) => {
    const id = route.request().url().split("/").pop() as keyof typeof held;
    const { symbol, name } = held[id];
    return route.fulfill(
      json({
        id,
        symbol,
        name,
        assetType: "STOCK",
        currency: "USD",
        exchange: "NASDAQ",
        status: "ACTIVE",
        metadata: {},
      }),
    );
  });
}

/** What the server pushes when a price moves. */
function priceTick(assetId: string, amount: string) {
  return JSON.stringify({
    id: "e1",
    type: "MARKET_PRICE_UPDATED",
    channel: `market:${assetId}`,
    sequence: 1,
    timestamp: new Date().toISOString(),
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd(amount),
      previousPrice: usd("170.00"),
      change: usd("11.20"),
      changePercent: 2.6,
      tickChange: usd("0.10"),
    },
  });
}

/** The tick can only arrive once the app asked for the channel. */
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

    test("updates the current price of a position of the portfolio with a tick", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await mockPortfolio(page);
      await page.goto("/portfolios/p1");
      const role = width <= MOBILE_MAX ? "list" : "table";
      await page.getByRole(role, { name: /Positions/ }).waitFor();
      // A tick that arrives before the first read has no price to change.
      await expect(page.getByText("$180.70")).toBeVisible();
      await waitForSubscription(realtime, "market:a1");
      await waitForSubscription(realtime, "market:a2");

      realtime.sockets[0]?.send(priceTick("a1", "181.20"));

      await expect(page.getByText("$181.20")).toBeVisible();
      await expect(page.getByText("$180.70")).toHaveCount(0);
      // The other position did not move.
      await expect(page.getByText("$50.00")).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("updates the value and the return of the dashboard with a tick", async ({ page }) => {
      const realtime = await mockRealtime(page);
      await mockPortfolio(page);
      await page.goto("/");
      await expect(page.getByText("$2,057.00").first()).toBeVisible();
      await waitForSubscription(realtime, "market:a1");

      // AAPL goes from 180.70 to 190.70: ten shares add 100.00.
      realtime.sockets[0]?.send(priceTick("a1", "190.70"));

      await expect(page.getByText("$2,157.00").first()).toBeVisible();
      await expect(page.getByText("+$457.00").first()).toBeVisible();
      await expect(page.getByText("$2,057.00")).toHaveCount(0);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });
  });
}
