import { expect, test } from "@playwright/test";
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

const viewports = [
  { name: "mobile", width: 390, height: 800 },
  { name: "tablet", width: 768, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
];

test.beforeEach(async ({ page }) => {
  await mockApi(page, { refresh: signedInReply });
  await page.route("http://localhost:7001/api/v1/portfolios", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:4173",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        data: [
          portfolio("p1", "Conservador"),
          portfolio("p2", "Crecimiento"),
          ...Array.from({ length: 12 }, (_, i) => portfolio(`x${String(i)}`, `Extra ${String(i)}`)),
        ],
      }),
    }),
  );
});

for (const { name, width, height } of viewports) {
  test(`the page does not scroll by itself on ${name}: only the routed view scrolls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/portfolios");
    await page.getByRole("table").waitFor();

    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));

    expect(size.scrollWidth).toBe(size.clientWidth);
    expect(size.scrollHeight).toBe(size.clientHeight);
  });

  test(`opening the portfolio selector does not move the layout on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/portfolios");
    await page.getByRole("table").waitFor();
    const main = page.locator("main");
    const before = await main.boundingBox();

    await page
      .getByRole("button", { name: /Conservador/ })
      .first()
      .click();
    await expect(page.getByRole("menu")).toBeVisible();

    expect(await main.boundingBox()).toEqual(before);
  });
}
