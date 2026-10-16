import {
  TransactionStatus,
  assertChronologicallyValid,
  calculatePositionAfterTransaction,
  validateNewTransaction,
} from "@trading/domain";
import type {
  AssetRepository,
  Money,
  Page,
  PageRequest,
  Position,
  Transaction,
  TransactionListFilter,
  TransactionRepository,
  TransactionType,
  UnitOfWork,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface TransactionServiceDependencies {
  transactionRepository: Pick<TransactionRepository, "listByPortfolioId" | "getById">;
  assetRepository: Pick<AssetRepository, "getById">;
  /** Runs the create-transaction writes atomically (FR-074, NFR-015). */
  unitOfWork: UnitOfWork;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Source of "now" for the future-execution-date invariant (ADR-001 point 8). */
  clock: Clock;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
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
 * Transaction use cases.
 * Source: FR-014..FR-017, 07-api-spec.md §13-14, ADR-001 point 2.
 *
 * Ownership is enforced through the portfolio first, so a transaction of
 * another user's portfolio is indistinguishable from a missing one.
 */
export function createTransactionService(dependencies: TransactionServiceDependencies) {
  const {
    transactionRepository,
    assetRepository,
    unitOfWork,
    portfolioService,
    clock,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** Returns one page of an owned portfolio's transactions, optionally filtered. */
  async function listTransactions(
    actor: Actor,
    portfolioId: string,
    filter: TransactionListFilter,
    page: PageRequest,
  ): Promise<Page<Transaction>> {
    assertPermission(actor, "transaction:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    return transactionRepository.listByPortfolioId(portfolioId, filter, page);
  }

  /** Returns one transaction, scoped to its owning portfolio. */
  async function getTransactionById(
    actor: Actor,
    portfolioId: string,
    transactionId: string,
  ): Promise<Transaction> {
    assertPermission(actor, "transaction:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const transaction = await transactionRepository.getById(transactionId);

    if (transaction?.portfolioId !== portfolioId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return transaction;
  }

  /**
   * Creates a transaction and synchronously recalculates the affected
   * position (FR-017). Synchronous on purpose: the async job flow of
   * 07-api-spec.md §14 belongs to Phase 10 of 15-implementation-plan.md.
   *
   * Order: permission, portfolio ownership, asset existence (an unknown
   * asset is a client error, 404), domain validation. Then, inside one Unit
   * of Work: replay the asset's history with the new transaction in date
   * order and reject it if the held quantity would ever go negative (FR-018,
   * so a backdated transaction is checked too), persist the transaction,
   * recalculate the position (upsert, or
   * delete when a SELL closes it exactly), and mark the transaction
   * COMPLETED. If any step fails, everything rolls back and no orphaned
   * DRAFT transaction remains.
   */
  async function createTransaction(
    actor: Actor,
    portfolioId: string,
    input: CreateTransactionRequest,
  ): Promise<CreateTransactionResult> {
    assertPermission(actor, "transaction:create", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const asset = await assetRepository.getById(input.assetId);
    if (!asset) {
      throw new NotFoundError("The referenced asset could not be found.");
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

    validateNewTransaction(createInput, clock.now());

    return unitOfWork.run(async ({ transactions, positions }) => {
      const history = await transactions.listByPortfolioAndAsset(portfolioId, input.assetId);
      assertChronologicallyValid(history, {
        type: input.type,
        quantity: input.quantity,
        executedAt: input.executedAt ?? clock.now(),
      });

      const transaction = await transactions.create(createInput);

      const existingPosition = await positions.getByPortfolioAndAsset(portfolioId, input.assetId);
      const recalculated = calculatePositionAfterTransaction(existingPosition, createInput);

      let position: Position | null;

      if (recalculated === null) {
        // SELL exactly closed the position.
        if (existingPosition) {
          await positions.deleteByPortfolioAndAsset(portfolioId, input.assetId);
        }
        position = null;
      } else {
        position = await positions.upsert({
          portfolioId,
          assetId: input.assetId,
          quantity: recalculated.quantity,
          averageEntryPrice: recalculated.averageEntryPrice,
          currentPrice: recalculated.currentPrice,
        });
      }

      const completedTransaction = await transactions.updateStatus(
        transaction.id,
        TransactionStatus.COMPLETED,
      );

      return { transaction: completedTransaction, position };
    });
  }

  return { listTransactions, getTransactionById, createTransaction };
}

export type TransactionService = ReturnType<typeof createTransactionService>;
