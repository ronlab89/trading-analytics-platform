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
    dailyChange: { changeValue: usd("468.02"), changePercent: 1.9 },
  })),
  allocation: { groupBy: "asset", groups: [] },
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

async function waitForDashboard(page: Page) {
  await recentTransactions(page).waitFor();
  await performancePanel(page).locator(".recharts-surface").waitFor();
  await dailyReturns(page).locator(".recharts-surface").waitFor();
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
    expect(regions).toHaveLength(5);
    for (const region of regions) {
      const box = await boxOf(region);
      expect(box.x).toBeGreaterThanOrEqual(main.x);
      expect(box.x + box.width).toBeLessThanOrEqual(main.x + main.width);
    }
  });
}

test("on the desktop the total return sits under the value and beside the daily bars, below it they stack", async ({
  page,
}) => {
  const value = page.getByRole("region", { name: /^(Hello|Hola)/ });
  const totalReturn = page.getByRole("region", { name: /Total return|Retorno total/ });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await waitForDashboard(page);
  const side = {
    value: await boxOf(value),
    totalReturn: await boxOf(totalReturn),
    daily: await boxOf(dailyReturns(page)),
  };
  expect(side.totalReturn.x).toBe(side.value.x);
  expect(side.totalReturn.y).toBeGreaterThanOrEqual(side.value.y + side.value.height);
  expect(side.daily.x).toBeGreaterThan(side.totalReturn.x + side.totalReturn.width - 1);

  await page.setViewportSize({ width: 768, height: 800 });
  const stacked = { value: await boxOf(value), totalReturn: await boxOf(totalReturn) };
  expect(stacked.totalReturn.y).toBeGreaterThanOrEqual(stacked.value.y + stacked.value.height);
  expect(stacked.totalReturn.x).toBe(stacked.value.x);
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

    for (const panel of [performancePanel(page), dailyReturns(page)]) {
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
