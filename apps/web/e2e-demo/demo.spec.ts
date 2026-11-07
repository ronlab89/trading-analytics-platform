import { expect, test, type Page } from "@playwright/test";

async function enterDemo(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Enter the demo" }).click();
  await expect(page.getByRole("button", { name: "Demo data" })).toBeVisible();
}

async function pickDemoAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Demo data" }).click();
  await page.getByRole("menuitem", { name }).click();
}

test("the visitor picks a role and enters the demo", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("radio", { name: "Viewer" }).click();
  await page.getByRole("button", { name: "Enter the demo" }).click();

  await expect(page.getByRole("button", { name: "Demo data" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("a connection problem is shown and then recovers", async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  await pickDemoAction(page, "Simulate a connection problem");

  await expect(page.getByText("Reconnecting…")).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
});

test("a test notification moves the unread count of the bell", async ({ page }) => {
  await enterDemo(page);
  await expect(page.getByRole("button", { name: "Notifications, 2 unread" })).toBeVisible();

  await pickDemoAction(page, "Send a test notification");

  await expect(page.getByRole("button", { name: "Notifications, 3 unread" })).toBeVisible();
});

test("resetting the demo asks first and then starts again from the login", async ({ page }) => {
  await enterDemo(page);

  await pickDemoAction(page, "Reset demo");
  await expect(page.getByRole("dialog", { name: "Reset the demo?" })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Enter the demo" })).toBeVisible();
});

test("recording a transaction in the demo confirms it and closes the panel", async ({ page }) => {
  await enterDemo(page);
  // The session lives in memory, so the visitor moves through the app without reloading it.
  await page.getByRole("link", { name: "Transactions" }).first().click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.getByRole("button", { name: "New transaction" }).first().click();
  const panel = page.getByRole("dialog", { name: "New transaction" });
  await panel.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Buy" }).click();
  await panel.getByRole("combobox", { name: "Asset" }).click();
  await page.getByRole("option", { name: /NVDA/ }).click();
  await panel.getByLabel("Quantity").fill("3");
  await panel.getByLabel("Price per unit").fill("120");
  await panel.getByRole("button", { name: "Record transaction" }).click();

  await expect(page.getByText("Transaction recorded").first()).toBeVisible();
  await expect(panel).toBeHidden();
});
