import { Prisma, type Job as PrismaJob } from "../../generated/client/index.js";
import type { CreateJobInput, Job, JobPatch, JobRowError } from "@trading/domain";

/** `report` is `Json?` in the schema; the domain holds it as a list of row errors. */
function toDomainReport(report: PrismaJob["report"]): readonly JobRowError[] | null {
  return report === null ? null : (report as unknown as readonly JobRowError[]);
}

function toPrismaReport(
  report: readonly JobRowError[] | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return report === null ? Prisma.DbNull : (report as unknown as Prisma.InputJsonValue);
}

export function toDomainJob(row: PrismaJob): Job {
  return {
    id: row.id,
    userId: row.userId,
    portfolioId: row.portfolioId,
    type: row.type,
    status: row.status,
    stage: row.stage,
    attempt: row.attempt,
    processed: row.processed,
    total: row.total,
    failureReason: row.failureReason,
    report: toDomainReport(row.report),
    input: row.input,
    queuedAt: row.queuedAt,
    deadlineAt: row.deadlineAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt,
  };
}

export function toPrismaCreateInput(
  input: CreateJobInput,
  createdAt: Date,
): Prisma.JobUncheckedCreateInput {
  return {
    userId: input.userId,
    portfolioId: input.portfolioId,
    type: input.type,
    input: input.input,
    queuedAt: input.queuedAt,
    deadlineAt: input.deadlineAt,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * A patch changes the fields it names, `null` included, and leaves the rest
 * alone: Prisma skips a field that is left out.
 */
export function toPrismaPatch(patch: JobPatch): Prisma.JobUncheckedUpdateInput {
  const { report: _report, ...rest } = patch;

  return {
    ...rest,
    ...("report" in patch ? { report: toPrismaReport(patch.report) } : {}),
  };
}
