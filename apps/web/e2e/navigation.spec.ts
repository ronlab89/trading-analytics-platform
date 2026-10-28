import { expect, test } from "@playwright/test";

test("the home page renders its heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("an unknown route renders the not-found page with a link back home", async ({ page }) => {
  await page.goto("/does-not-exist");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Back to the start" }).click();

  await expect(page).toHaveURL("/");
});
