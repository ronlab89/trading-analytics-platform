import {
  PrismaTransactionRepository,
  PrismaPositionRepository,
  PrismaAssetRepository,
} from "@trading/database";
import { AppError } from "../errors/app-error.js";
import { getPortfolioById } from "./portfolio.service.js";
import {
  calculatePositionAfterTransaction,
  TransactionStatus,
  validateNewTransaction,
  type Money,
  type Position,
  type Transaction,
  type TransactionType,
} from "../../../../packages/domain/src/index.js";

const transactionRepository = new PrismaTransactionRepository();
const positionRepository = new PrismaPositionRepository();
const assetRepository = new PrismaAssetRepository();

export interface TransactionFilter {
  assetId?: string;
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Returns transactions for a portfolio, optionally filtered.
 * Source: FR-014 (List), FR-015 (Search), FR-016 (Filter).
 *
 * Ownership enforced by requiring the portfolio to belong to the
 * caller first, same pattern as listPositions.
 */
export async function listTransactions(
  userId: string,
  portfolioId: string,
  filter?: TransactionFilter,
): Promise<Transaction[]> {
  await getPortfolioById(userId, portfolioId);

  return transactionRepository.listByPortfolioId(portfolioId, filter);
}

/**
 * Returns a single transaction, scoped to its owning portfolio.
 * Source: 07-api-spec.md §13 (Get Transaction).
 *
 * Same 404-on-mismatch pattern as getPositionById: a transaction
 * belonging to another portfolio (and therefore another user) is
 * indistinguishable from a non-existent one.
 */
export async function getTransactionById(
  userId: string,
  portfolioId: string,
  transactionId: string,
): Promise<Transaction> {
  await getPortfolioById(userId, portfolioId);

  const transaction = await transactionRepository.getById(transactionId);

  if (transaction?.portfolioId !== portfolioId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return transaction;
}

export interface CreateTransactionRequest {
  assetId: string;
  type: TransactionType;
  quantity: number;
  price: Money;
  fees?: Money;
  executedAt?: Date;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  position: Position | null;
}

/**
 * Creates a transaction and synchronously recalculates the affected
 * position.
 * Source: FR-017 (Create Transaction), 07-api-spec.md §13-14.
 *
 * Deliberately synchronous for now, not the async job/jobId flow
 * sketched in 07-api-spec.md §14 (transaction processing as a
 * background job): this project has not implemented background
 * operations yet (that is Phase 10 of 15-implementation-plan.md).
 * Introducing an async job here ahead of that phase would mean solving
 * job orchestration prematurely for a single call site (NFR-070). This
 * endpoint can be migrated to the async shape later without changing
 * its external contract in a breaking way (the response can start
 * including a `processing` field alongside `transaction` when that
 * phase arrives).
 *
 * Orchestration, per FR-017's workflow:
 *   1. Validate the portfolio exists and belongs to the caller.
 *   2. Validate the asset exists (an asset id that doesn't resolve to
 *      a real asset is a client error, not a 500 — surfaced as 404,
 *      distinct from the transaction's own shape validation).
 *   3. Validate transaction domain invariants (validateNewTransaction).
 *   4. Persist the transaction record (immutable historical fact).
 *   5. Recalculate the position: read existing position for this
 *      portfolio+asset pair, compute the new position state via
 *      calculatePositionAfterTransaction, then either upsert it or
 *      delete it (when a SELL exactly closes the position).
 *   6. Mark the transaction COMPLETED once the position has been
 *      synchronized.
 *
 * Steps 4-6 are not wrapped in a single database transaction yet — see
 * NFR-074 (Atomic Business Operations). This is a known, deliberate gap
 * to flag in PROGRESS.md rather than an oversight: a failure between
 * persisting the transaction and updating the position could leave the
 * transaction record in DRAFT with no corresponding position change.
 * Wrapping this in an actual DB transaction (Prisma's `$transaction`)
 * is the natural follow-up once this endpoint is otherwise verified
 * end-to-end.
 */
export async function createTransaction(
  userId: string,
  portfolioId: string,
  input: CreateTransactionRequest,
): Promise<CreateTransactionResult> {
  await getPortfolioById(userId, portfolioId);

  const asset = await assetRepository.getById(input.assetId);
  if (!asset) {
    throw new AppError("NOT_FOUND", "The referenced asset could not be found.", 404);
  }

  const createInput = {
    portfolioId,
    assetId: input.assetId,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    ...(input.fees !== undefined ? { fees: input.fees } : {}),
    ...(input.executedAt !== undefined ? { executedAt: input.executedAt } : {}),
  };

  validateNewTransaction(createInput);

  const transaction = await transactionRepository.create(createInput);

  const existingPosition = await positionRepository.getByPortfolioAndAsset(
    portfolioId,
    input.assetId,
  );
  const recalculated = calculatePositionAfterTransaction(existingPosition, createInput);

  let position: Position | null;

  if (recalculated === null) {
    // SELL exactly closed the position.
    if (existingPosition) {
      await positionRepository.deleteByPortfolioAndAsset(portfolioId, input.assetId);
    }
    position = null;
  } else {
    position = await positionRepository.upsert({
      portfolioId,
      assetId: input.assetId,
      quantity: recalculated.quantity,
      averageEntryPrice: recalculated.averageEntryPrice,
      currentPrice: recalculated.currentPrice,
    });
  }

  const completedTransaction = await transactionRepository.updateStatus(
    transaction.id,
    TransactionStatus.COMPLETED,
  );

  return { transaction: completedTransaction, position };
}
