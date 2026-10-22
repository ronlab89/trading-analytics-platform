import type {
  CreateJobInput,
  Job,
  JobRepository,
  JobStatus,
  TransitionJobInput,
} from "@trading/domain";
import { Prisma } from "../../generated/client/index.js";
import { prisma, type DatabaseClient } from "../client.js";
import { toDomainJob, toPrismaCreateInput, toPrismaPatch } from "../mappers/job-mapper.js";

/**
 * Prisma-backed implementation of `JobRepository`.
 *
 * Accepts an optional client so it can join a Unit of Work
 * (see prisma-unit-of-work.ts); defaults to the shared client.
 */
export class PrismaJobRepository implements JobRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient = prisma) {
    this.db = db;
  }

  async create(input: CreateJobInput): Promise<Job> {
    const row = await this.db.job.create({ data: toPrismaCreateInput(input, new Date()) });
    return toDomainJob(row);
  }

  async getById(id: string): Promise<Job | null> {
    const row = await this.db.job.findUnique({ where: { id } });
    return row ? toDomainJob(row) : null;
  }

  async listByStatuses(statuses: readonly JobStatus[]): Promise<Job[]> {
    const rows = await this.db.job.findMany({
      where: { status: { in: [...statuses] } },
      orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toDomainJob);
  }

  /**
   * The compare-and-set: `update` with the expected status, stage and attempt
   * in its `where` changes the row only if they still match, in one
   * statement. No match is Prisma's P2025, which means "someone else moved
   * the job", so it resolves null.
   */
  async transition(input: TransitionJobInput): Promise<Job | null> {
    try {
      const row = await this.db.job.update({
        where: {
          id: input.id,
          status: input.expected.status,
          stage: input.expected.stage,
          attempt: input.expected.attempt,
        },
        data: { ...toPrismaPatch(input.patch), updatedAt: input.updatedAt },
      });
      return toDomainJob(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }
}
