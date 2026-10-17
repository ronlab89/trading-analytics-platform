import {
  InvalidTransactionError,
  Money,
  TransactionStatus,
  TransactionType,
  replayPosition,
  replayRealizedPnL,
  validateNewTransaction,
} from "@trading/domain";
import type {
  AssetRepository,
  Page,
  PageRequest,
  Position,
  Transaction,
  TransactionListFilter,
  TransactionRepository,
  UnitOfWork,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import type { Clock } from "./clock.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import { assertPortfolioWritable } from "./portfolio-guard.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";
import { buildRealizedByTransaction } from "./realized-sales.js";

export interface TransactionServiceDependencies {
  transactionRepository: Pick<
    TransactionRepository,
    "listByPortfolioId" | "listCompletedByPortfolioId" | "getById"
  >;
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

/** A transaction with the P/L it realized: `null` for a BUY and for a transaction that is not `COMPLETED`. */
export interface TransactionWithRealizedPnL {
  transaction: Transaction;
  realizedPnL: Money | null;
}

export interface CreateTransactionResult extends TransactionWithRealizedPnL {
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

  /**
   * Returns one page of an owned portfolio's transactions, optionally filtered, each
   * SELL with the P/L it realized. The P/L comes from replaying the whole history,
   * not only the page, because the average cost at a sale depends on every earlier BUY.
   */
  async function listTransactions(
    actor: Actor,
    portfolioId: string,
    filter: TransactionListFilter,
    page: PageRequest,
  ): Promise<Page<TransactionWithRealizedPnL>> {
    assertPermission(actor, "transaction:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const [items, completed] = await Promise.all([
      transactionRepository.listByPortfolioId(portfolioId, filter, page),
      transactionRepository.listCompletedByPortfolioId(portfolioId),
    ]);
    const realized = buildRealizedByTransaction(completed, portfolio.baseCurrency);

    return {
      ...items,
      items: items.items.map((transaction) => ({
        transaction,
        realizedPnL: realized.get(transaction.id) ?? null,
      })),
    };
  }

  /** Returns one transaction, scoped to its owning portfolio, with the P/L it realized. */
  async function getTransactionById(
    actor: Actor,
    portfolioId: string,
    transactionId: string,
  ): Promise<TransactionWithRealizedPnL> {
    assertPermission(actor, "transaction:read", permissions);
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);

    const transaction = await transactionRepository.getById(transactionId);

    if (transaction?.portfolioId !== portfolioId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    const realized = buildRealizedByTransaction(
      await transactionRepository.listCompletedByPortfolioId(portfolioId),
      portfolio.baseCurrency,
    );

    return { transaction, realizedPnL: realized.get(transaction.id) ?? null };
  }

  /**
   * Creates a transaction and synchronously recalculates the affected
   * position (FR-017). Synchronous on purpose: the async job flow of
   * 07-api-spec.md §14 belongs to Phase 10 of 15-implementation-plan.md.
   *
   * Order: permission, portfolio ownership, archived-portfolio guard (409,
   * ADR-010 point 5), asset existence (an unknown
   * asset is a client error, 404), the single-currency rule (400, ADR-004
   * point 12), domain validation. Then, inside one Unit
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
    const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);
    assertPortfolioWritable(portfolio);

    const asset = await assetRepository.getById(input.assetId);
    if (!asset) {
      throw new NotFoundError("The referenced asset could not be found.");
    }
    if (asset.currency !== portfolio.baseCurrency) {
      throw new InvalidTransactionError(
        `The asset is in ${asset.currency} but the portfolio is in ${portfolio.baseCurrency}: version 1 is single-currency.`,
      );
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
      // Serializes concurrent creations on this asset, so two SELLs cannot both
      // be validated against the same history (FR-017 race).
      await transactions.lockPortfolioAsset(portfolioId, input.assetId);

      const history = await transactions.listByPortfolioAndAsset(portfolioId, input.assetId);
      // Throws InsufficientPositionQuantityError when the candidate, at its
      // place in date order, would leave a negative quantity at any point.
      const replayed = replayPosition([
        ...history,
        {
          type: input.type,
          quantity: input.quantity,
          price: input.price,
          fees: input.fees ?? Money.zero(input.price.currency),
          executedAt: input.executedAt ?? clock.now(),
        },
      ]);

      const transaction = await transactions.create(createInput);

      const existingPosition = await positions.getByPortfolioAndAsset(portfolioId, input.assetId);

      let position: Position | null;

      if (replayed === null) {
        // The replay leaves nothing held: the position is closed.
        if (existingPosition) {
          await positions.deleteByPortfolioAndAsset(portfolioId, input.assetId);
        }
        position = null;
      } else {
        position = await positions.upsert({
          portfolioId,
          assetId: input.assetId,
          quantity: replayed.quantity,
          averageEntryPrice: replayed.averageEntryPrice,
          // Tracks market data (FR-045): seeded from the trade price only when first opened.
          currentPrice: existingPosition?.currentPrice ?? input.price,
          openedAt: replayed.openedAt,
        });
      }

      const completedTransaction = await transactions.updateStatus(
        transaction.id,
        TransactionStatus.COMPLETED,
      );

      // A SELL realizes against the average cost at its place in date order, with
      // the same replay as the position; a BUY realizes nothing.
      const realizedPnL =
        completedTransaction.type === TransactionType.SELL
          ? (replayRealizedPnL(
              [...history, completedTransaction],
              portfolio.baseCurrency,
            ).sales.find((sale) => sale.transactionId === completedTransaction.id)?.realizedPnL ??
            null)
          : null;

      return { transaction: completedTransaction, position, realizedPnL };
    });
  }

  return { listTransactions, getTransactionById, createTransaction };
}

export type TransactionService = ReturnType<typeof createTransactionService>;
