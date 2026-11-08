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

const transaction = {
  id: "t1",
  portfolioId: "p1",
  assetId: "a1",
  type: "BUY",
  quantity: 10,
  price: { amount: "180.20", currency: "USD" },
  fees: { amount: "1.00", currency: "USD" },
  realizedPnL: null,
  status: "COMPLETED",
  executedAt: "2026-10-06T14:29:00.000Z",
  createdAt: "2026-10-06T14:29:00.000Z",
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
  progress: { processed: 1, total: 2 },
  queuedAt: "2026-11-06T10:00:00.000Z",
  deadlineAt: "2026-11-06T10:10:00.000Z",
  createdAt: "2026-11-06T10:00:00.000Z",
  updatedAt: "2026-11-06T10:00:01.000Z",
  finishedAt: null,
  ...patch,
});

/**
 * The API as the import sees it: one portfolio with one transaction, an import that queues a job,
 * and a job that answers what the test lines up, one answer per read (the last one repeats). The
 * socket is not mocked, so the dialog follows the job by polling it. The server records what the
 * app sent and how many times it read the list of transactions.
 */
async function mockImport(page: Page, reads: Job[]) {
  const server = {
    imports: [] as {
      contentType: string | undefined;
      body: string | null;
      key: string | undefined;
    }[],
    jobReads: 0,
    cancels: 0,
    transactionReads: 0,
  };
  await mockApi(page, { refresh: signedInReply });
  await page.route(`${API}/portfolios`, (route) => route.fulfill(json([portfolio])));
  await page.route(`${API}/portfolios/p1/transactions?*`, (route) => {
    server.transactionReads += 1;
    return route.fulfill({
      ...json(null),
      body: JSON.stringify({
        data: [transaction],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }),
    });
  });
  await page.route(`${API}/assets/*`, (route) =>
    route.fulfill(
      json({
        id: "a1",
        symbol: "AAPL",
        name: "Apple Inc.",
        assetType: "STOCK",
        currency: "USD",
        exchange: "NASDAQ",
        status: "ACTIVE",
        metadata: {},
      }),
    ),
  );
  await page.route(`${API}/portfolios/p1/imports`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    server.imports.push({
      contentType: request.headers()["content-type"],
      body: request.postData(),
      key: request.headers()["idempotency-key"],
    });
    return route.fulfill(json(jobOf({ status: "QUEUED", stage: "QUEUED" }), 202));
  });
  await page.route(`${API}/jobs/j1/cancel`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    server.cancels += 1;
    reads.splice(0, reads.length, jobOf({ status: "CANCELLED" }));
    return route.fulfill(json(jobOf({ status: "CANCELLED" })));
  });
  await page.route(`${API}/jobs/j1`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    const answer = reads[Math.min(server.jobReads, reads.length - 1)];
    server.jobReads += 1;
    return route.fulfill(json(answer));
  });
  return server;
}

async function openAndSend(page: Page) {
  await page.goto("/transactions");
  await expect(page.getByText("Apple Inc.").first()).toBeVisible();
  await page.getByRole("button", { name: "Import CSV" }).click();
  const dialog = page.getByRole("dialog", { name: "Import transactions" });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await expect(dialog.getByText("transactions.csv · 2 rows")).toBeVisible();
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  return dialog;
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

    test("sends the file as raw CSV, follows the job and refreshes the list when it completes", async ({
      page,
    }) => {
      const server = await mockImport(page, [
        jobOf({ status: "QUEUED", stage: "QUEUED", progress: { processed: 0, total: 0 } }),
        jobOf(),
        jobOf({ status: "COMPLETED", stage: "APPLYING", progress: { processed: 2, total: 2 } }),
      ]);
      const dialog = await openAndSend(page);
      const readsBefore = server.transactionReads;

      await expect(dialog.getByText("The import finished.")).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByText("2 transactions were added to the portfolio.")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cancel import" })).toHaveCount(0);

      expect(server.imports).toHaveLength(1);
      expect(server.imports[0]?.contentType).toContain("text/csv");
      expect(server.imports[0]?.body).toBe(CSV);
      expect(server.imports[0]?.key).toBeTruthy();
      await expect.poll(() => server.transactionReads).toBeGreaterThan(readsBefore);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("lists the rows to fix when the file fails validation", async ({ page }) => {
      await mockImport(page, [
        jobOf({
          status: "FAILED",
          failureReason: "VALIDATION_FAILED",
          report: [
            { row: 0, message: "The header is wrong." },
            { row: 3, message: "Unknown symbol." },
          ],
        }),
      ]);
      const dialog = await openAndSend(page);

      await expect(dialog.getByText("The file has rows that cannot be imported.")).toBeVisible({
        timeout: 15_000,
      });
      await expect(dialog.getByText("Rows to fix")).toBeVisible();
      await expect(dialog.getByText("The header is wrong.")).toBeVisible();
      await expect(dialog.getByText("Row 3")).toBeVisible();
      await expect(dialog.getByText("Unknown symbol.")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(0);
      const size = await pageSize(page);
      expect(size.scrollWidth).toBe(size.clientWidth);
    });

    test("cancels a job that is still validating", async ({ page }) => {
      const server = await mockImport(page, [jobOf()]);
      const dialog = await openAndSend(page);

      await dialog.getByRole("button", { name: "Cancel import" }).click();

      await expect(dialog.getByText("The import was cancelled.")).toBeVisible();
      expect(server.cancels).toBe(1);
      await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
    });
  });
}
