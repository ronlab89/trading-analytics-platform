import type { TransactionalRepositories, UnitOfWork } from "@trading/domain";
import type { InMemoryPositionRepository } from "./in-memory-position-repository.js";
import type { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";

export interface InMemoryUnitOfWorkRepositories {
  readonly transactions: InMemoryTransactionRepository;
  readonly positions: InMemoryPositionRepository;
}

/**
 * In-memory implementation of `UnitOfWork`.
 * Source: FR-074, NFR-015, docs/06-architecture.md §30, docs/12-demo-mode-spec.md §4.
 *
 * Works on the repositories it is given, so what a committed unit writes is
 * visible to everyone who holds them. Rollback restores a snapshot taken before
 * the unit started. Because a snapshot restores the whole state, units run one
 * at a time (queued in request order): otherwise a unit that fails while
 * another one is in flight would erase the other's writes. A failed unit
 * rethrows its error unchanged and does not block the units queued behind it.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repositories: InMemoryUnitOfWorkRepositories) {}

  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.execute(work));
    this.queue = result.catch(() => undefined);

    return result;
  }

  private async execute<T>(
    work: (repositories: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const { transactions, positions } = this.repositories;
    const transactionsSnapshot = transactions.snapshot();
    const positionsSnapshot = positions.snapshot();

    try {
      return await work({ transactions, positions });
    } catch (error) {
      transactions.restore(transactionsSnapshot);
      positions.restore(positionsSnapshot);
      throw error;
    }
  }
}
