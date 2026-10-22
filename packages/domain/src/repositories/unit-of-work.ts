import type { IdempotencyKeyRepository } from "./idempotency-key-repository";
import type { JobRepository } from "./job-repository";
import type { PositionRepository } from "./position-repository";
import type { TransactionRepository } from "./transaction-repository";

/**
 * Repositories that participate in a single atomic unit of work.
 * Every repository here shares the same underlying transaction.
 * `jobs` lets an import set its job `COMPLETED` in the unit that writes its
 * rows; `idempotencyKeys` lets a mutation store its response in the unit that
 * commits it (ADR-008 points 5 and 8).
 */
export interface TransactionalRepositories {
  transactions: TransactionRepository;
  positions: PositionRepository;
  jobs: JobRepository;
  idempotencyKeys: IdempotencyKeyRepository;
}

/**
 * Unit of Work contract.
 * Source: FR-074 (Atomic Business Operations), NFR-015 (Operation
 * Consistency), 06-architecture.md §30 (Transaction Boundaries).
 *
 * Runs `work` atomically: if it throws, every write made through the
 * provided repositories is rolled back; if it resolves, all writes are
 * committed together. Keeps persistence technology (Prisma, in-memory
 * mock for the demo) behind the domain boundary (NFR-057).
 */
export interface UnitOfWork {
  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T>;
}
