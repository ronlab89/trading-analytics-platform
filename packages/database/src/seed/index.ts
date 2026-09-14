import { wipeDatabase } from "./wipe.js";
import { createEmptySeedContext } from "./context.js";

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

  const context = createEmptySeedContext();

  // Step 6.2+: seed steps will be chained here, e.g.
  // context = await seedUsersAndPortfolios(context);
  // context = await seedAssets(context);
  // context = await seedPositionsAndTransactions(context);
  // context = await seedDecisionsScenariosAlerts(context);
  // context = await seedHistoricalPrices(context);

  console.log("[seed] done (no data steps implemented yet — Step 6.1 scaffolding only).");
  console.log("[seed] context:", context);
}
