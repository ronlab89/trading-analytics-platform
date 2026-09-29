import type { CreateTransactionInput, Transaction } from "../entities/transaction";
import type { TransactionStatus, TransactionType } from "../entities/enums";
import type { Page, PageRequest } from "./pagination";

/**
 * Filters supported when listing a portfolio's transactions.
 * Source: 07-api-spec.md §13 (List Transactions filters), FR-015/FR-016.
 */
export interface TransactionListFilter {
  assetId?: string;
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Transaction repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * Deliberately narrower than PortfolioRepository/UserRepository: a
 * Transaction is a historical fact once created (05-data-model.md §43,
 * Historical Integrity). There is no generic `update()` or `delete()`
 * here — only its processing status may change over time
 * (05-data-model.md §10, Transaction Lifecycle). Business fields
 * (quantity, price, executedAt, ...) are immutable once recorded.
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface TransactionRepository {
  /**
   * Returns one page of a portfolio's transactions, optionally filtered.
   * Source: FR-014 (List Transactions), FR-015 (Search), FR-016 (Filter),
   * 07-api-spec.md §13 and §40.
   *
   * Ordered by `executedAt` descending (most recent first) with `id`
   * descending as a tiebreaker, so pagination is stable even when
   * several transactions share the same execution time.
   */
  listByPortfolioId(
    portfolioId: string,
    filter: TransactionListFilter,
    page: PageRequest,
  ): Promise<Page<Transaction>>;

  /**
   * Returns a single transaction by id, or null if it does not exist.
   */
  getById(id: string): Promise<Transaction | null>;

  /**
   * Creates a new transaction.
   * Source: FR-017 (Create Transaction).
   *
   * Callers are expected to have already run `validateNewTransaction`
   * (see entities/transaction.ts) before calling this. This method only
   * persists the transaction record itself — recalculating dependent
   * Position/Portfolio/Analytics state (FR-017's workflow diagram) is an
   * application-layer orchestration concern, not this repository's.
   */
  create(input: CreateTransactionInput): Promise<Transaction>;

  /**
   * Transitions a transaction's processing status.
   * Source: 05-data-model.md §10 (Transaction Lifecycle).
   *
   * This is the only mutation allowed on an existing transaction — see
   * this file's top-level doc comment for why business fields are not
   * separately updatable.
   */
  updateStatus(id: string, status: TransactionStatus): Promise<Transaction>;
}
