import { expect, test, type Page } from "@playwright/test";
import { errorReply, mockApi, signedInReply } from "./support/mock-api";

async function signOutFromTheMenu(page: Page) {
  await page.getByRole("button", { name: "User menu" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}

test("signing out ends the session and sends the visitor to the login", async ({ page }) => {
  const api = await mockApi(page, { refresh: signedInReply });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();

  await signOutFromTheMenu(page);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  expect(api.logoutCalls()).toBe(1);
});

test("after signing out the shell is closed to the visitor", async ({ page }) => {
  const api = await mockApi(page, { refresh: signedInReply });
  await page.goto("/");
  await signOutFromTheMenu(page);
  await expect(page).toHaveURL(/\/login$/);

  // The refresh cookie went with the session: restoring it is refused now.
  api.reply("refresh", errorReply(401, "UNAUTHORIZED"));
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});

test("when the logout fails the visitor is told and stays signed in", async ({ page }) => {
  const api = await mockApi(page, {
    refresh: signedInReply,
    logout: errorReply(503, "SERVICE_UNAVAILABLE"),
  });
  await page.goto("/");

  await signOutFromTheMenu(page);

  await expect(page.getByText("Could not sign out")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("main")).toBeVisible();
  expect(api.logoutCalls()).toBe(1);
});
