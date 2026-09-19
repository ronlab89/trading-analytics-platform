import { wipeDatabase } from "./wipe.js";
import { createEmptySeedContext } from "./context.js";
import { seedUsersAndPortfolios } from "./steps/seed-users-and-portfolios.js";
import { seedAssets } from "./steps/seed-assets.js";
import { seedPositionsAndTransactions } from "./steps/seed-positions-and-transactions.js";
import { seedDecisions } from "./steps/seed-decisions.js";
import { seedScenarios } from "./steps/seed-scenarios.js";
import { seedAlerts } from "./steps/seed-alerts.js";
import { seedNotifications } from "./steps/seed-notifications.js";
import { seedHistoricalPrices } from "./steps/seed-historical-prices.js";

/**
 * Entry point for the DB seed workflow (Phase 2, Step 6).
 *
 * Not to be confused with Demo Mode's `simulationSeed` (12-demo-mode-spec.md
 * §16), which controls pseudo-random market simulation in the browser-only
 * demo (Phase 11) and shares no code with this module.
 *
 * Idempotent by design: always wipes before seeding, so re-running this
 * script never produces duplicate or drifted data.
 */
export async function seedDatabase(): Promise<void> {
  console.log("[seed] wiping existing data...");
  await wipeDatabase();

  let context = createEmptySeedContext();

  context = await seedUsersAndPortfolios(context);
  context = await seedAssets(context);
  context = await seedPositionsAndTransactions(context);
  context = await seedDecisions(context);
  context = await seedScenarios(context);
  context = await seedAlerts(context);
  context = await seedNotifications(context);
  context = await seedHistoricalPrices(context);

  console.log("[seed] done.");
  console.log("[seed] context:", context);
}
