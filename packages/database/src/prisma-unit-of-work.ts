import type { TransactionalRepositories, UnitOfWork } from "@trading/domain";
import { prisma } from "./client.js";
import { PrismaAlertRepository } from "./repositories/prisma-alert-repository.js";
import { PrismaIdempotencyKeyRepository } from "./repositories/prisma-idempotency-key-repository.js";
import { PrismaJobRepository } from "./repositories/prisma-job-repository.js";
import { PrismaNotificationRepository } from "./repositories/prisma-notification-repository.js";
import { PrismaPositionRepository } from "./repositories/prisma-position-repository.js";
import { PrismaTransactionRepository } from "./repositories/prisma-transaction-repository.js";

/**
 * Prisma implementation of `UnitOfWork` using an interactive
 * `$transaction`. Repositories handed to `work` are bound to the
 * transaction-scoped client, so all their writes commit or roll back
 * together. Any error thrown by `work` aborts the transaction and is
 * re-thrown unchanged (domain errors keep their type).
 */
export class PrismaUnitOfWork implements UnitOfWork {
  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) =>
      work({
        transactions: new PrismaTransactionRepository(tx),
        positions: new PrismaPositionRepository(tx),
        jobs: new PrismaJobRepository(tx),
        idempotencyKeys: new PrismaIdempotencyKeyRepository(tx),
        alerts: new PrismaAlertRepository(tx),
        notifications: new PrismaNotificationRepository(tx),
      }),
    );
  }
}
