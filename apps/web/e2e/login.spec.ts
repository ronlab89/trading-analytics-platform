import { expect, test, type Page } from "@playwright/test";
import { errorReply, mockApi, signedInReply } from "./support/mock-api";

async function signInWith(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const signInHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Sign in" });

test("a visitor with no session is sent to the login", async ({ page }) => {
  await mockApi(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(signInHeading(page)).toBeVisible();
});

test("signing in lands on the page the visitor was going to", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/does-not-exist");
  await expect(signInHeading(page)).toBeVisible();

  api.reply("login", signedInReply);
  await signInWith(page, "jane@example.com", "secret");

  await expect(page).toHaveURL(/\/does-not-exist$/);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  expect(api.loginBodies).toEqual([{ email: "jane@example.com", password: "secret" }]);
});

test("a visitor with a valid session skips the login", async ({ page }) => {
  await mockApi(page, { refresh: signedInReply });

  await page.goto("/login");

  await expect(page).toHaveURL(/\/$/);
  await expect(signInHeading(page)).toHaveCount(0);
});

test("invalid fields are explained and nothing is sent", async ({ page }) => {
  const api = await mockApi(page);
  await page.goto("/login");

  await signInWith(page, "not-an-email", "");

  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByText("Enter your password")).toBeVisible();
  expect(api.loginBodies).toEqual([]);
});

test("wrong credentials show an alert and keep the visitor on the login", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login");

  await signInWith(page, "jane@example.com", "wrong");

  await expect(page.getByRole("alert")).toContainText("Wrong email or password");
  await expect(page).toHaveURL(/\/login$/);
});

test("too many attempts are told apart from wrong credentials", async ({ page }) => {
  await mockApi(page, { login: errorReply(429, "RATE_LIMITED") });
  await page.goto("/login");

  await signInWith(page, "jane@example.com", "secret");

  await expect(page.getByRole("alert")).toContainText("Too many attempts");
});

test("when the service is down the visitor can try again and get in", async ({ page }) => {
  const api = await mockApi(page, { login: "network-error" });
  await page.goto("/login");
  await signInWith(page, "jane@example.com", "secret");
  await expect(page.getByRole("alert")).toContainText("Service unavailable");

  api.reply("login", signedInReply);
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page).toHaveURL(/\/$/);
});

// RequireAuth sets `from`; a crafted history entry plays the part of a hostile one. The
// first row proves the entry reaches the page, so the second is not passing for nothing.
for (const { from, lands } of [
  { from: "/does-not-exist", lands: "http://localhost:4173/does-not-exist" },
  { from: "//evil.example", lands: "http://localhost:4173/" },
]) {
  test(`after signing in, a destination of ${from} lands on ${lands}`, async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/login");
    await page.evaluate((destination) => {
      window.history.replaceState({ usr: { from: destination }, key: "x", idx: 0 }, "");
    }, from);
    await page.reload();
    await expect(signInHeading(page)).toBeVisible();

    api.reply("login", signedInReply);
    await signInWith(page, "jane@example.com", "secret");

    await expect(page).toHaveURL(lands);
  });
}
