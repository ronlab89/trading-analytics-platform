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
