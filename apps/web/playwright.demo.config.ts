import { defineConfig, devices } from "@playwright/test";

const port = 4174;

/**
 * The smoke of the demo build: it serves the built demo (not the dev server), with no API and no
 * mocks behind it, because the demo is everything it needs.
 */
export default defineConfig({
  testDir: "./e2e-demo",
  fullyParallel: true,
  // The first page of each worker starts the whole demo (composition and seed), which is slow cold.
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-demo" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build:demo && pnpm exec vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
