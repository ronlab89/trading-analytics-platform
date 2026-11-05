import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";
import { mockRealtime } from "./support/mock-realtime";

const API = "http://localhost:7001/api/v1";

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

const MOBILE_MAX = 560;
const DESKTOP_MIN = 901;

const cors = {
  "Access-Control-Allow-Origin": "http://localhost:4173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: cors,
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
  a1: { symbol: "AAPL", name: "Apple Inc.", price: "180.70" },
  a2: { symbol: "SPY", name: "SPDR S&P 500 ETF", price: "560.20" },
};

interface HeldAlert {
  id: string;
  userId: string;
  assetId: string | null;
  portfolioId: string | null;
  type: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const alertOf = (
  id: string,
  assetId: string,
  condition: string,
  threshold: number,
  enabled: boolean,
  createdAt: string,
): HeldAlert => ({
  id,
  userId: "u-1",
  assetId,
  portfolioId: null,
  type: "PRICE",
  condition,
  threshold,
  enabled,
  createdAt,
  updatedAt: createdAt,
});

/**
 * The API as the alerts see it: the watchlist of two assets with their prices, and the alerts the
 * server holds, which the app changes through create, update and delete. The server records what
 * the app sent, so the tests can check the requests and not only the screen.
 */
async function mockAlerts(page: Page) {
  const server = {
    alerts: [
      alertOf("al1", "a1", "ABOVE", 200, true, "2026-11-02T10:00:00.000Z"),
      alertOf("al2", "a2", "BELOW", 500, false, "2026-11-01T10:00:00.000Z"),
    ],
    created: [] as unknown[],
    patches: [] as { id: string; body: unknown }[],
    deleted: [] as string[],
  };
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
        Object.entries(assets).map(([assetId, { price }]) => ({
          assetId,
          price: usd(price),
          previousPrice: usd("170.00"),
          change: usd("1.00"),
          changePercent: 2.1,
          timestamp: "2026-11-03T14:32:07.000Z",
          source: "MOCK",
        })),
      ),
    ),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/v1/alerts"),
    async (route) => {
      const request = route.request();
      const id = new URL(request.url()).pathname.split("/").at(4) ?? "";
      switch (request.method()) {
        case "OPTIONS":
          return route.fulfill({ status: 204, headers: cors });
        case "POST": {
          const body = request.postDataJSON() as Record<string, unknown>;
          server.created.push(body);
          const created = alertOf(
            `al${String(server.alerts.length + 1)}`,
            String(body.assetId),
            String(body.condition),
            Number(body.threshold),
            body.enabled !== false,
            "2026-11-05T10:00:00.000Z",
          );
          server.alerts.push(created);
          return route.fulfill(json(created, 201));
        }
        case "PATCH": {
          const body = request.postDataJSON() as Partial<HeldAlert>;
          server.patches.push({ id, body });
          const held = server.alerts.find((candidate) => candidate.id === id);
          if (held) Object.assign(held, body);
          return route.fulfill(json(held));
        }
        case "DELETE":
          server.deleted.push(id);
          server.alerts = server.alerts.filter((candidate) => candidate.id !== id);
          return route.fulfill({ status: 204, headers: cors });
        default:
          return route.fulfill(json(server.alerts));
      }
    },
  );
  return server;
}

/** The row of an alert: a card on the phone, a table row from the tablet. */
function rowOf(page: Page, width: number, name: string) {
  return width <= MOBILE_MAX
    ? page.getByRole("list", { name: "Alerts" }).getByRole("listitem").filter({ hasText: name })
    : page.getByRole("table", { name: "Alerts" }).getByRole("row").filter({ hasText: name });
}

const menuOf = (page: Page, name: string) =>
  page.getByRole("button", { name: `Actions for ${name}` });

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
      await mockRealtime(page);
    });

    test("lists the alerts with their asset, condition, threshold and status", async ({ page }) => {
      await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      const apple = rowOf(page, width, "Apple Inc.");
      await expect(apple).toContainText("Above");
      await expect(apple).toContainText("$200.00");
      await expect(apple).toContainText("Active");
      const spy = rowOf(page, width, "SPDR S&P 500 ETF");
      await expect(spy).toContainText("Below");
      await expect(spy).toContainText("$500.00");
      await expect(spy).toContainText("Paused");
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("counts the alerts in the header line from the tablet, and shows the title on a phone", async ({
      page,
    }) => {
      await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      if (width <= MOBILE_MAX) {
        await expect(page.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();
        await expect(page.getByText("2 alerts · price alerts")).toHaveCount(0);
      } else {
        await expect(page.getByText("2 alerts · price alerts")).toBeVisible();
      }
    });

    test("shows the Updated column only on the desktop, as a table, and cards on a phone", async ({
      page,
    }) => {
      await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      if (width <= MOBILE_MAX) {
        await expect(page.getByRole("list", { name: "Alerts" })).toBeVisible();
        await expect(page.getByRole("table")).toHaveCount(0);
      } else {
        await expect(page.getByRole("table", { name: "Alerts" })).toBeVisible();
        await expect(page.getByRole("columnheader", { name: "Updated" })).toHaveCount(
          width >= DESKTOP_MIN ? 1 : 0,
        );
      }
    });

    test("creates an alert from the bell of an asset, with the hint, and lists it", async ({
      page,
    }) => {
      const server = await mockAlerts(page);
      await page.goto("/markets");
      await page.getByRole("button", { name: "Create an alert for AAPL" }).click();

      const dialog = page.getByRole("dialog", { name: "Create alert" });
      await expect(dialog.getByRole("textbox", { name: /Asset/ })).toHaveValue("AAPL · Apple Inc.");
      await dialog.getByRole("textbox", { name: /Threshold/ }).fill("150");
      await expect(
        dialog.getByText(
          "It is already above $150.00, so it will fire the next time the price crosses it again.",
        ),
      ).toBeVisible();
      await dialog.getByRole("textbox", { name: /Threshold/ }).fill("200");
      await expect(
        dialog.getByText("Now $180.70. It fires when the price goes above $200.00."),
      ).toBeVisible();
      const box = await dialog.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);

      await dialog.getByRole("button", { name: "Create alert" }).click();

      await expect(dialog).toHaveCount(0);
      expect(server.created).toEqual([
        { assetId: "a1", type: "PRICE", condition: "ABOVE", threshold: 200, enabled: true },
      ]);
      await expect(page.getByText("Alert created")).toBeVisible();
      await page.getByRole("tab", { name: "Alerts" }).click();
      await expect(rowOf(page, width, "Apple Inc.")).toHaveCount(2);
    });

    test("pauses an alert from its menu, and resumes it", async ({ page }) => {
      const server = await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      await menuOf(page, "Apple Inc.").click();
      await page.getByRole("menuitem", { name: "Pause" }).click();

      await expect(rowOf(page, width, "Apple Inc.")).toContainText("Paused");
      expect(server.patches).toEqual([{ id: "al1", body: { enabled: false } }]);

      await menuOf(page, "Apple Inc.").click();
      await page.getByRole("menuitem", { name: "Resume" }).click();

      await expect(rowOf(page, width, "Apple Inc.")).toContainText("Active");
      expect(server.patches.at(-1)).toEqual({ id: "al1", body: { enabled: true } });
    });

    test("edits an alert, sending only what changed", async ({ page }) => {
      const server = await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      await menuOf(page, "Apple Inc.").click();
      await page.getByRole("menuitem", { name: "Edit" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit alert" });
      await expect(dialog.getByRole("textbox", { name: /Asset/ })).toBeDisabled();
      await dialog.getByRole("textbox", { name: /Threshold/ }).fill("250");
      await dialog.getByRole("button", { name: "Save changes" }).click();

      await expect(dialog).toHaveCount(0);
      expect(server.patches).toEqual([{ id: "al1", body: { threshold: 250 } }]);
      await expect(rowOf(page, width, "Apple Inc.")).toContainText("$250.00");
    });

    test("deletes an alert only after the user confirms", async ({ page }) => {
      const server = await mockAlerts(page);
      await page.goto("/markets?tab=alerts");

      await menuOf(page, "Apple Inc.").click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      const dialog = page.getByRole("dialog", { name: "Delete this alert?" });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toHaveCount(0);
      expect(server.deleted).toEqual([]);

      await menuOf(page, "Apple Inc.").click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("dialog", { name: "Delete this alert?" })
        .getByRole("button", { name: "Delete" })
        .click();

      await expect(rowOf(page, width, "Apple Inc.")).toHaveCount(0);
      expect(server.deleted).toEqual(["al1"]);
      await expect(page.getByText("Alert deleted")).toBeVisible();
    });
  });
}
