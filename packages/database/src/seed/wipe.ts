import { prisma } from "../client.js";

/**
 * Deletes all seed-managed data, in strict reverse-FK-dependency order.
 *
 * Order derived from packages/database/prisma/schema.prisma (Phase 2 Step 6.1):
 *   User        -> Portfolio, WatchlistItem, Alert, Notification, UserPreference
 *   Portfolio   -> Transaction, Position, Decision, Scenario, Alert
 *   Asset       -> Transaction, Position, Decision, WatchlistItem, Alert,
 *                  MarketPrice, MarketEvent, HistoricalPrice
 *   Decision    -> DecisionEvent
 *
 * Deleting children before parents means this works correctly regardless
 * of each relation's onDelete behavior in the schema — it does not rely on
 * CASCADE to do the job implicitly.
 */
export async function wipeDatabase(): Promise<void> {
  await prisma.decisionEvent.deleteMany();
  await prisma.marketEvent.deleteMany();
  await prisma.historicalPrice.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.watchlistItem.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.position.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany();
}
