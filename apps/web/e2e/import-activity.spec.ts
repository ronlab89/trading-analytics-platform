import { expect, test, type Page } from "@playwright/test";
import { mockApi, signedInReply } from "./support/mock-api";

const API = "http://localhost:7001/api/v1";

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

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

const CSV = [
  "symbol,type,quantity,price,executedAt",
  "AAPL,BUY,10,180.20,2026-10-06T14:29:00.000Z",
  "AAPL,SELL,5,185.00,2026-10-07T14:29:00.000Z",
].join("\n");

type Job = Record<string, unknown>;

const jobOf = (patch: Job = {}): Job => ({
  id: "j1",
  portfolioId: "p1",
  type: "CSV_IMPORT",
  status: "PROCESSING",
  stage: "VALIDATING",
  attempt: 1,
  failureReason: null,
  report: null,
  progress: { processed: 40, total: 100 },
  queuedAt: "2026-11-07T10:00:00.000Z",
  deadlineAt: "2026-11-07T10:10:00.000Z",
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:01.000Z",
  finishedAt: null,
  ...patch,
});

/**
 * The API as the import and the activity see it: a portfolio with no transactions, no
 * notifications, an import that queues a job, and a job that answers what `server.job` holds, so a
 * test decides when it moves on. The socket is not mocked, so the job is followed by polling.
 */
async function mockImportAndActivity(page: Page) {
  const server = { job: jobOf() };
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/portfolios/p1/transactions?*`, (route) =>
    route.fulfill({
      ...json(null),
      body: JSON.stringify({
        data: [],
        meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      }),
    }),
  );
  await page.route(`${API}/notifications*`, (route) => route.fulfill(json([])));
  await page.route(`${API}/portfolios/p1/imports`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    return route.fulfill(json(jobOf({ status: "QUEUED", stage: "QUEUED" }), 202));
  });
  await page.route(`${API}/jobs/j1`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    return route.fulfill(json(server.job));
  });
  return server;
}

/** Starts an import from Transactions and closes its window, leaving the job running. */
async function startAnImport(page: Page) {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog", { name: "Import transactions" });
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByRole("progressbar", { name: "Import progress" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).last().click();
  await expect(dialog).toBeHidden();
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

    test("lists an import that is running, with its bar, after its window was closed", async ({
      page,
    }) => {
      await mockImportAndActivity(page);
      await startAnImport(page);

      await page.goto("/activity", { waitUntil: "domcontentloaded" });

      await expect(page.getByText("Importing orders.csv")).toBeVisible();
      await expect(page.getByText("Validating · 40 of 100")).toBeVisible();
      await expect(page.getByRole("progressbar", { name: "Import progress" })).toHaveAttribute(
        "aria-valuenow",
        "40",
      );
      await expect(page.getByText(/Process · \d{2}:\d{2}/)).toBeVisible();
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("opens the import on its progress from View process", async ({ page }) => {
      await mockImportAndActivity(page);
      await startAnImport(page);
      await page.goto("/activity", { waitUntil: "domcontentloaded" });

      await page.getByRole("button", { name: "View process" }).click();

      const dialog = page.getByRole("dialog", { name: "Import transactions" });
      await expect(dialog.getByRole("progressbar", { name: "Import progress" })).toBeVisible();
      await expect(dialog.getByText("Validating")).toBeVisible();
      await expect(dialog.getByLabel("choose a file")).toHaveCount(0);
    });

    test("turns the row into a completed import once the job finishes", async ({ page }) => {
      const server = await mockImportAndActivity(page);
      await startAnImport(page);
      await page.goto("/activity", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Importing orders.csv")).toBeVisible();

      server.job = jobOf({
        status: "COMPLETED",
        stage: "APPLYING",
        progress: { processed: 2, total: 2 },
        finishedAt: "2026-11-07T10:00:05.000Z",
      });

      await expect(page.getByText("Import completed")).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByText("orders.csv · 2 transactions were added to the portfolio."),
      ).toBeVisible();
      await expect(page.getByRole("progressbar", { name: "Import progress" })).toHaveCount(0);
    });

    test("narrows the list to the processes with the Process source", async ({ page }) => {
      await mockImportAndActivity(page);
      await startAnImport(page);
      await page.goto("/activity", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Importing orders.csv")).toBeVisible();

      await page.getByRole("button", { name: "Filters" }).click();
      await page.getByRole("checkbox", { name: "Process" }).check();
      await page.getByRole("button", { name: "Apply filters" }).click();

      await expect(page.getByText("Importing orders.csv")).toBeVisible();
      await expect(page.getByRole("button", { name: "Filters · 1" })).toBeVisible();
    });
  });
}
