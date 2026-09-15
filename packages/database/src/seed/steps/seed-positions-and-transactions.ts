import { validateNewTransaction, validateNewPosition } from "@trading/domain";
import { PrismaTransactionRepository } from "../../repositories/prisma-transaction-repository.js";
import { PrismaPositionRepository } from "../../repositories/prisma-position-repository.js";
import { SEED_POSITIONS } from "../data/positions-and-transactions.js";
import { resolvePortfolioId, resolveAssetId } from "../resolve.js";
import type { SeedContext } from "../context.js";

const transactionRepository = new PrismaTransactionRepository();
const positionRepository = new PrismaPositionRepository();

/**
 * Seeds transactions (as completed historical facts) and the resulting
 * position for each blueprint in SEED_POSITIONS.
 *
 * Transactions are created via `create()` (which persists with the
 * schema default status DRAFT) and then explicitly moved to COMPLETED
 * via `updateStatus()` — `CreateTransactionInput` does not accept a
 * status field by design (see transaction-repository.ts: "a transaction
 * is a historical fact once recorded; only its processing status may
 * change"). All seed transactions represent already-settled history, so
 * COMPLETED is the correct terminal state here (transient states like
 * PROCESSING/FAILED belong to Demo Mode failure injection, Phase 11 —
 * not to hardcoded seed data).
 */
export async function seedPositionsAndTransactions(context: SeedContext): Promise<SeedContext> {
  console.log("[seed] seeding positions and transactions...");

  for (const blueprint of SEED_POSITIONS) {
    const portfolioId = resolvePortfolioId(context, blueprint.portfolioName);
    const assetId = resolveAssetId(context, blueprint.assetSymbol);

    for (const tx of blueprint.transactions) {
      const transactionInput = {
        portfolioId,
        assetId,
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        ...(tx.fees !== undefined ? { fees: tx.fees } : {}),
        executedAt: tx.executedAt,
      };

      validateNewTransaction(transactionInput);
      const transaction = await transactionRepository.create(transactionInput);
      await transactionRepository.updateStatus(transaction.id, "COMPLETED");
    }

    const positionInput = {
      portfolioId,
      assetId,
      quantity: blueprint.quantity,
      averageEntryPrice: blueprint.averageEntryPrice,
      currentPrice: blueprint.currentPrice,
    };

    validateNewPosition(positionInput);
    await positionRepository.upsert(positionInput);
  }

  return context;
}
