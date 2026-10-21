import type { TransactionalRepositories, UnitOfWork } from "@trading/domain";
import type { InMemoryIdempotencyKeyRepository } from "./in-memory-idempotency-key-repository.js";
import type { InMemoryJobRepository } from "./in-memory-job-repository.js";
import type { InMemoryPositionRepository } from "./in-memory-position-repository.js";
import type { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";

export interface InMemoryUnitOfWorkRepositories {
  readonly transactions: InMemoryTransactionRepository;
  readonly positions: InMemoryPositionRepository;
  readonly jobs: InMemoryJobRepository;
  readonly idempotencyKeys: InMemoryIdempotencyKeyRepository;
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
    const { transactions, positions, jobs, idempotencyKeys } = this.repositories;
    const transactionsSnapshot = transactions.snapshot();
    const positionsSnapshot = positions.snapshot();
    const jobsSnapshot = jobs.snapshot();
    const idempotencyKeysSnapshot = idempotencyKeys.snapshot();

    try {
      return await work({ transactions, positions, jobs, idempotencyKeys });
    } catch (error) {
      transactions.restore(transactionsSnapshot);
      positions.restore(positionsSnapshot);
      jobs.restore(jobsSnapshot);
      idempotencyKeys.restore(idempotencyKeysSnapshot);
      throw error;
    }
  }
}
