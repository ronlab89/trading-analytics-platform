import { z } from "zod";
import { PortfolioStatus } from "@trading/domain";
import type { Portfolio } from "@trading/domain";
import {
  archiveMetaSchema,
  isoTimestampSchema,
  presentTimestamp,
} from "./response-common.schema.js";

const portfolioStatusValues = Object.values(PortfolioStatus) as [
  PortfolioStatus,
  ...PortfolioStatus[],
];

/**
 * Response shape for the portfolio endpoints.
 * Source: 07-api-spec.md (Portfolios), 05-data-model.md §6.
 */
export const portfolioResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseCurrency: z.string(),
  status: z.enum(portfolioStatusValues),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>;

/** POST /portfolios/:portfolioId/archive: idempotent, flags a repeat call in `meta`. */
export const archivePortfolioResponseSchema = z.object({
  data: portfolioResponseSchema,
  meta: archiveMetaSchema,
});

export function presentPortfolio(portfolio: Portfolio): PortfolioResponse {
  return {
    id: portfolio.id,
    userId: portfolio.userId,
    name: portfolio.name,
    description: portfolio.description,
    baseCurrency: portfolio.baseCurrency,
    status: portfolio.status,
    createdAt: presentTimestamp(portfolio.createdAt),
    updatedAt: presentTimestamp(portfolio.updatedAt),
  };
}
