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
