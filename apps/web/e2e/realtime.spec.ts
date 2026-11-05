import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";

const WS_URL = "ws://localhost:7001/ws";
const API = "http://localhost:7001/api/v1";

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "Access-Control-Allow-Origin": "http://localhost:4173",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify({ data }),
});

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

interface RealtimeMock {
  /** Every connection the app opened, oldest first. */
  sockets: WebSocketRoute[];
  /** What the app sent over any of them. */
  received: { type?: string }[];
}

/**
 * Stands in for the server socket: it accepts the authentication of every connection, as a healthy
 * server does, and keeps the connections so a test can drop one.
 */
async function mockRealtime(page: Page): Promise<RealtimeMock> {
  const mock: RealtimeMock = { sockets: [], received: [] };
  await page.routeWebSocket(WS_URL, (socket) => {
    mock.sockets.push(socket);
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as { type?: string };
      mock.received.push(message);
      if (message.type === "AUTHENTICATE") {
        socket.send(JSON.stringify({ type: "ACK", request: "AUTHENTICATE" }));
      }
    });
  });
  return mock;
}

/** The Markets page with a signed-in user and an empty watchlist: enough to see the connection. */
async function openMarkets(page: Page) {
  const watchlistRequests = { count: 0 };
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/watchlist`, (route) => {
    watchlistRequests.count += 1;
    return route.fulfill(json([]));
  });
  return watchlistRequests;
}

async function pageSize(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

const statusBar = (page: Page) => page.getByRole("contentinfo", { name: "Status" });
const alertTitle = (page: Page) => page.getByText("Offline: prices are paused");

for (const { name, width, height } of viewports) {
  test.describe(`on ${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
    });

    test("authenticates in the first message and shows the connection as live", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openMarkets(page);

      await page.goto("/markets");

      await expect(statusBar(page)).toContainText("Live");
      expect(realtime.received[0]).toEqual({ type: "AUTHENTICATE", accessToken: "access-token" });
      expect(realtime.sockets[0]?.url()).toBe(WS_URL);
      await expect(alertTitle(page)).toHaveCount(0);
    });

    test("warns that prices are paused when the connection drops, and recovers by itself", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openMarkets(page);
      await page.goto("/markets");
      await expect(statusBar(page)).toContainText("Live");

      await realtime.sockets[0]?.close({ code: 1006, reason: "lost" });

      await expect(statusBar(page)).toContainText("Reconnecting");
      await expect(alertTitle(page)).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
      const box = await alertTitle(page).boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(width);

      // The first retry comes after about a second.
      await expect(statusBar(page)).toContainText("Live", { timeout: 5_000 });
      await expect(alertTitle(page)).toHaveCount(0);
      expect(realtime.sockets).toHaveLength(2);
    });

    test("gives up on a limit close and reconnects only when the user retries", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      await openMarkets(page);
      await page.goto("/markets");
      await expect(statusBar(page)).toContainText("Live");

      await realtime.sockets[0]?.close({ code: 4008, reason: "limit" });

      await expect(statusBar(page)).toContainText("Offline");
      await expect(page.getByText("We could not restore the connection")).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
      await page.waitForTimeout(1_500);
      expect(realtime.sockets).toHaveLength(1);

      await page.getByRole("button", { name: "Retry" }).click();

      await expect(statusBar(page)).toContainText("Live");
      await expect(page.getByText("We could not restore the connection")).toHaveCount(0);
      expect(realtime.sockets).toHaveLength(2);
    });
  });
}

test("reads the visible data again every ten seconds while the connection is down", async ({
  page,
}) => {
  await page.clock.install();
  const realtime = await mockRealtime(page);
  const watchlist = await openMarkets(page);
  await page.goto("/markets");
  await expect(statusBar(page)).toContainText("Live");
  await page.clock.runFor(30_000);
  const whileLive = watchlist.count;

  await realtime.sockets[0]?.close({ code: 4008, reason: "limit" });
  await expect(statusBar(page)).toContainText("Offline");
  const atDrop = watchlist.count;
  await page.clock.runFor(10_000);

  await expect.poll(() => watchlist.count).toBeGreaterThan(atDrop);
  // While it was live nothing polled: the few reads are the ones the screen itself made.
  expect(whileLive).toBeLessThanOrEqual(2);
});
