import { Money, TransactionStatus } from "@trading/domain";
import type {
  CreateTransactionInput,
  Page,
  PageRequest,
  Transaction,
  TransactionListFilter,
  TransactionRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

export interface StoredTransaction {
  readonly transaction: Transaction;
  /** Creation order, the tie-break between transactions that share an `executedAt`. */
  readonly sequence: number;
}

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryTransactionSnapshot {
  readonly rows: ReadonlyMap<string, StoredTransaction>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `TransactionRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: a new transaction is DRAFT with zero fees in the
 * price currency, `executedAt` defaults to now, the list is ordered most
 * recent first (`executedAt`, then newest created first) and filtered by
 * asset, type and an inclusive date range. There is no generic update or
 * delete: only the status changes, and `updateStatus` throws when the row does
 * not exist.
 */
export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly rows = new Map<string, StoredTransaction>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryTransactionSnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryTransactionSnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  listByPortfolioId(
    portfolioId: string,
    filter: TransactionListFilter,
    { page, pageSize }: PageRequest,
  ): Promise<Page<Transaction>> {
    const matching = [...this.rows.values()]
      .filter(
        ({ transaction: t }) =>
          t.portfolioId === portfolioId &&
          (filter.assetId === undefined || t.assetId === filter.assetId) &&
          (filter.type === undefined || t.type === filter.type) &&
          (filter.dateFrom === undefined || t.executedAt.getTime() >= filter.dateFrom.getTime()) &&
          (filter.dateTo === undefined || t.executedAt.getTime() <= filter.dateTo.getTime()),
      )
      .sort(
        (a, b) =>
          b.transaction.executedAt.getTime() - a.transaction.executedAt.getTime() ||
          b.sequence - a.sequence,
      );

    return Promise.resolve({
      items: matching.slice((page - 1) * pageSize, page * pageSize).map((s) => s.transaction),
      total: matching.length,
    });
  }

  getById(id: string): Promise<Transaction | null> {
    return Promise.resolve(this.rows.get(id)?.transaction ?? null);
  }

  create(input: CreateTransactionInput): Promise<Transaction> {
    const timestamp = this.now();
    const sequence = ++this.sequence;

    const transaction: Transaction = {
      id: `transaction_${String(sequence)}`,
      portfolioId: input.portfolioId,
      assetId: input.assetId,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      fees: input.fees ?? Money.zero(input.price.currency),
      status: TransactionStatus.DRAFT,
      executedAt: input.executedAt ?? timestamp,
      createdAt: timestamp,
    };
    this.rows.set(transaction.id, { transaction, sequence });

    return Promise.resolve(transaction);
  }

  updateStatus(id: string, status: TransactionStatus): Promise<Transaction> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Transaction ${id} does not exist.`));
    }

    const transaction: Transaction = { ...existing.transaction, status };
    this.rows.set(id, { transaction, sequence: existing.sequence });

    return Promise.resolve(transaction);
  }
}
