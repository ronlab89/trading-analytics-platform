import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";
import { mockRealtime, type RealtimeMock } from "./support/mock-realtime";

const API = "http://localhost:7001/api/v1";

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

const cors = {
  "Access-Control-Allow-Origin": "http://localhost:4173",
  "Access-Control-Allow-Credentials": "true",
};

const json = (data: unknown) => ({
  status: 200,
  contentType: "application/json",
  headers: cors,
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

interface Held {
  id: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  readAt: string | null;
  createdAt: string;
}

const notificationOf = ({ id, severity, readAt, createdAt }: Held) => ({
  id,
  userId: "u-1",
  type: "TEST",
  title: `Title ${id}`,
  message: `Message ${id}`,
  severity,
  readAt,
  createdAt,
  metadata: {},
});

/**
 * The notifications the server holds, and what the app asked it to mark. Two are unread (a warning
 * and an information) and an error is already read, so the bell counts 2 and the status bar 1 alert.
 */
async function mockNotifications(page: Page) {
  const server = {
    held: [
      { id: "n1", severity: "WARNING", readAt: null, createdAt: "2026-11-05T14:00:00.000Z" },
      { id: "n2", severity: "INFO", readAt: null, createdAt: "2026-11-05T13:00:00.000Z" },
      {
        id: "n3",
        severity: "ERROR",
        readAt: "2026-11-05T13:30:00.000Z",
        createdAt: "2026-11-05T12:00:00.000Z",
      },
    ] as Held[],
    markedOne: [] as string[],
    markedAll: 0,
  };
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/notifications*`, (route) =>
    route.fulfill(json(server.held.map(notificationOf))),
  );
  await page.route(`${API}/notifications/read-all`, (route) => {
    server.markedAll += 1;
    server.held.forEach((held) => {
      held.readAt ??= new Date().toISOString();
    });
    return route.fulfill({ status: 204, headers: cors });
  });
  await page.route(`${API}/notifications/*/read`, (route) => {
    const id = route.request().url().split("/").at(-2) ?? "";
    server.markedOne.push(id);
    const held = server.held.find((candidate) => candidate.id === id);
    if (held) held.readAt ??= new Date().toISOString();
    return route.fulfill(json(held ? notificationOf(held) : null));
  });
  return server;
}

/** What the server pushes when a notification is created. */
const notificationCreated = (notificationId: string) =>
  JSON.stringify({
    id: "e1",
    type: "NOTIFICATION_CREATED",
    channel: "notifications",
    sequence: 1,
    timestamp: new Date().toISOString(),
    epoch: "epoch-1",
    payload: { notificationId },
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

const statusBar = (page: Page) => page.getByRole("contentinfo", { name: "Status" });
const bell = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

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

    test("counts the unread notifications in the bell and the alerts in the status bar", async ({
      page,
    }) => {
      await mockRealtime(page);
      await mockNotifications(page);
      await page.goto("/portfolios");

      await expect(bell(page, "Notifications, 2 unread").first()).toBeVisible();
      await expect(statusBar(page)).toContainText("1 alert");
    });

    test("opens the panel inside the screen and marks a notification as read with a click", async ({
      page,
    }) => {
      await mockRealtime(page);
      const server = await mockNotifications(page);
      await page.goto("/portfolios");
      await bell(page, "Notifications, 2 unread").first().click();

      const panel = page.getByRole("dialog", { name: "Notifications" });
      await expect(panel.getByText("Title n1")).toBeVisible();
      await expect(panel.getByText("Title n3")).toBeVisible();
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);

      await panel.getByRole("button", { name: /Title n2/ }).click();

      await expect(panel.getByRole("button", { name: /Title n2/ })).toHaveCount(0);
      expect(server.markedOne).toEqual(["n2"]);
      // On the phone the sheet is modal and hides the page from assistive technology until it closes.
      await page.keyboard.press("Escape");
      await expect(bell(page, "Notifications, 1 unread").first()).toBeVisible();
    });

    test("marks them all as read from the bottom of the panel", async ({ page }) => {
      await mockRealtime(page);
      const server = await mockNotifications(page);
      await page.goto("/portfolios");
      await bell(page, "Notifications, 2 unread").first().click();

      const markAll = page
        .getByRole("dialog", { name: "Notifications" })
        .getByRole("button", { name: "Mark all as read" });
      await markAll.click();

      await expect(markAll).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(bell(page, "Notifications").first()).toBeVisible();
      await expect(statusBar(page)).toContainText("0 alerts");
      expect(server.markedAll).toBe(1);
    });

    test("tells the user about a warning that arrives by the socket, and counts it", async ({
      page,
    }) => {
      const realtime = await mockRealtime(page);
      const server = await mockNotifications(page);
      await page.goto("/portfolios");
      await expect(bell(page, "Notifications, 2 unread").first()).toBeVisible();
      await waitForSubscription(realtime, "notifications");

      server.held.push({
        id: "n9",
        severity: "WARNING",
        readAt: null,
        createdAt: new Date().toISOString(),
      });
      realtime.sockets[0]?.send(notificationCreated("n9"));

      await expect(page.getByText("Title n9")).toBeVisible();
      await expect(bell(page, "Notifications, 3 unread").first()).toBeVisible();
      await expect(statusBar(page)).toContainText("2 alerts");
    });
  });
}
