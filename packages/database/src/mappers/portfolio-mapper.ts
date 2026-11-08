import type { Portfolio as PrismaPortfolio } from "../../generated/client/index.js";
import type { CreatePortfolioInput, Portfolio, PortfolioStatus } from "@trading/domain";

/**
 * Portfolio mapper.
 *
 * Prisma generates `PortfolioStatus` as a real TypeScript enum whose
 * underlying string values are identical to the domain's const-object
 * union type (packages/domain/src/entities/enums.ts). The values match
 * 1:1, but the two are nominally distinct TS types, so the cast below
 * is an explicit, intentional bridge between them — never a silent
 * `as any`. If the two ever diverge (e.g. Prisma schema adds a status
 * value the domain doesn't know about yet), this is the single place
 * that would need to change.
 */
function toDomainStatus(status: PrismaPortfolio["status"]): PortfolioStatus {
  return status;
}

/**
 * Converts a Prisma `Portfolio` row into the domain `Portfolio` entity.
 */
export function toDomainPortfolio(row: PrismaPortfolio): Portfolio {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    baseCurrency: row.baseCurrency,
    status: toDomainStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Converts a domain `CreatePortfolioInput` into the shape Prisma's
 * `portfolio.create()` expects.
 *
 * `status` and `description` are optional on the domain input
 * (see entities/portfolio.ts); when omitted, Prisma's own schema
 * defaults apply (`status` defaults to ACTIVE — see schema.prisma).
 * We therefore only forward them when explicitly provided, rather
 * than inventing a default here and duplicating the one already
 * declared in the schema.
 */
export function toPrismaCreateInput(input: CreatePortfolioInput) {
  return {
    userId: input.userId,
    name: input.name,
    baseCurrency: input.baseCurrency,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
}
