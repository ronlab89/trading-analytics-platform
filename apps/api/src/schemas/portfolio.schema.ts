import { z } from "zod";

/**
 * Request-boundary validation for POST /api/v1/portfolios.
 * Source: 07-api-spec.md §10 (Create Portfolio).
 *
 * This validates shape/type only. Domain invariants (e.g. currency
 * format, non-empty trimmed name) are enforced separately by
 * `validateNewPortfolio` in @trading/domain — see 09-security-spec.md
 * §19 (transport validation must not replace business-rule validation;
 * both are required).
 */
export const createPortfolioRequestSchema = z.object({
  name: z.string().min(1, "Portfolio name is required."),
  baseCurrency: z.string().length(3, "Base currency must be a 3-letter currency code."),
  description: z.string().optional(),
});

export type CreatePortfolioRequestBody = z.infer<typeof createPortfolioRequestSchema>;

/**
 * Request-boundary validation for PATCH /api/v1/portfolios/:portfolioId.
 * Source: 07-api-spec.md §10 (Update Portfolio), FR-010.
 *
 * `baseCurrency` is deliberately not editable after creation: changing
 * a portfolio's base currency once transactions exist against it would
 * silently invalidate historical valuations (05-data-model.md §43,
 * Historical Integrity). Only `name` and `description` may be updated.
 *
 * At least one field must be present — an empty patch is not a
 * meaningful update.
 */
export const updatePortfolioRequestSchema = z
  .object({
    name: z.string().min(1, "Portfolio name is required.").optional(),
    description: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field (name or description) must be provided.",
  });

export type UpdatePortfolioRequestBody = z.infer<typeof updatePortfolioRequestSchema>;
