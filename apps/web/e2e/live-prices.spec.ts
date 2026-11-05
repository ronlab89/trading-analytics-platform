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

const assets = {
  a1: { symbol: "AAPL", name: "Apple Inc.", price: "180.70", changePercent: 2.1 },
  a2: { symbol: "SPY", name: "SPDR S&P 500 ETF", price: "560.20", changePercent: 0.5 },
};

/** The watchlist of two assets, with the prices the first read over HTTP gives. */
async function openWatchlist(page: Page) {
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/watchlist`, (route) =>
    route.fulfill(
      json(
        Object.keys(assets).map((assetId) => ({
          id: `w-${assetId}`,
          userId: "u-1",
          assetId,
          createdAt: "2026-11-01T10:00:00.000Z",
        })),
      ),
    ),
  );
  await page.route(`${API}/assets/*`, (route) => {
    const id = route.request().url().split("/").pop() as keyof typeof assets;
    const { symbol, name } = assets[id];
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
  await page.route(`${API}/market/prices?*`, (route) =>
    route.fulfill(
      json(
        Object.entries(assets).map(([assetId, { price, changePercent }]) => ({
          assetId,
          price: usd(price),
          previousPrice: usd("170.00"),
          change: usd("1.00"),
          changePercent,
          timestamp: "2026-11-03T14:32:07.000Z",
          source: "MOCK",
        })),
      ),
    ),
  );
}

/** What the server pushes when a price moves. */
function priceTick(assetId: string, amount: string, changePercent: number, sequence = 1) {
  return JSON.stringify({
    id: `e${String(sequence)}`,
    type: "MARKET_PRICE_UPDATED",
    channel: `market:${assetId}`,
    sequence,
    timestamp: new Date().toISOString(),
    epoch: "epoch-1",
    payload: {
      assetId,
      price: usd(amount),
      previousPrice: usd("170.00"),
      change: usd("11.20"),
      changePercent,
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

const statusBar = (page: Page) => page.getByRole("contentinfo", { name: "Status" });

for (const { name, width, height } of viewports) {
  test.describe(`on ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
    });

    test("asks for the market channel of each watched asset and updates the row with a tick", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openWatchlist(page);
      await page.goto("/markets");
      const role = width <= MOBILE_MAX ? "list" : "table";
      await page.getByRole(role, { name: "Watchlist" }).waitFor();
      await expect(page.getByText("$180.70")).toBeVisible();
      await waitForSubscription(realtime, "market:a1");
      await waitForSubscription(realtime, "market:a2");

      realtime.sockets[0]?.send(priceTick("a1", "181.20", 2.6));

      await expect(page.getByText("$181.20")).toBeVisible();
      await expect(page.getByText("+2.60%")).toBeVisible();
      await expect(page.getByText("$180.70")).toHaveCount(0);
      // The other asset did not move.
      await expect(page.getByText("$560.20")).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("fills the change badge for a moment after a tick, then lets it rest", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openWatchlist(page);
      await page.goto("/markets");
      await waitForSubscription(realtime, "market:a1");

      realtime.sockets[0]?.send(priceTick("a1", "181.20", 2.6));

      const badge = page.getByText("+2.60%");
      await expect(badge).toHaveClass(/solid/);
      await expect(badge).toHaveClass(/subtle/, { timeout: 3_000 });
    });

    test("says the prices are paused when the connection is lost, and gives the change back after", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openWatchlist(page);
      await page.goto("/markets");
      await expect(statusBar(page)).toContainText("Live");
      await expect(page.getByText("+2.10%")).toBeVisible();

      await realtime.sockets[0]?.close({ code: 1006, reason: "lost" });

      await expect(page.getByText("Paused", { exact: true })).toHaveCount(2);
      await expect(page.getByText("+2.10%")).toHaveCount(0);
      // The price stays: it is the last one received.
      await expect(page.getByText("$180.70")).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);

      await expect(statusBar(page)).toContainText("Live", { timeout: 5_000 });
      await expect(page.getByText("Paused", { exact: true })).toHaveCount(0);
      await expect(page.getByText("+2.10%")).toBeVisible();
    });
  });
}

test("a tick the server sends after a newer read does not take the price back", async ({
  page,
}) => {
  const realtime = await mockRealtime(page);
  await openWatchlist(page);
  await page.goto("/markets");
  await waitForSubscription(realtime, "market:a1");
  realtime.sockets[0]?.send(priceTick("a1", "181.20", 2.6, 2));
  await expect(page.getByText("$181.20")).toBeVisible();

  // An event stamped in the past is older than what the row already shows.
  realtime.sockets[0]?.send(
    JSON.stringify({
      ...JSON.parse(priceTick("a1", "150.00", -5, 3)),
      timestamp: "2026-11-01T00:00:00.000Z",
    }),
  );

  await page.waitForTimeout(500);
  await expect(page.getByText("$181.20")).toBeVisible();
  await expect(page.getByText("$150.00")).toHaveCount(0);
});
