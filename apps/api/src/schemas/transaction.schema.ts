import { z } from "zod";

/**
 * Request-boundary shape for a monetary value in JSON payloads.
 *
 * The domain's `Money` value object is constructed from this shape
 * (`Money.of(amount, currency)`) inside the service layer — this
 * schema only validates the wire format, not domain invariants like
 * "price must be positive" (that's `validateNewTransaction` in
 * @trading/domain, per 09-security-spec.md §19: transport validation
 * must not replace business-rule validation, both are required).
 *
 * `amount` accepts a string or number: a string avoids IEEE 754
 * precision loss for clients that can send exact decimal text: a
 * number is accepted for convenience/simpler test payloads.
 */
const moneyRequestSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  currency: z.string().length(3, "Currency must be a 3-letter currency code."),
});

/**
 * Request-boundary validation for
 * POST /api/v1/portfolios/:portfolioId/transactions.
 * Source: 07-api-spec.md §13 (Create Transaction), FR-017/FR-018.
 *
 * Only BUY and SELL are accepted, matching TransactionType's current
 * scope (01-product-spec.md §8 — DIVIDEND/FEE/DEPOSIT/WITHDRAWAL are
 * documented as future types, not yet modeled).
 */
export const createTransactionRequestSchema = z.object({
  assetId: z.string().min(1, "assetId is required."),
  type: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantity must be greater than zero."),
  price: moneyRequestSchema,
  fees: moneyRequestSchema.optional(),
  executedAt: z.coerce.date().optional(),
});

export type CreateTransactionRequestBody = z.infer<typeof createTransactionRequestSchema>;

/**
 * Query-parameter validation for
 * GET /api/v1/portfolios/:portfolioId/transactions.
 * Source: 07-api-spec.md §13 (List Transactions filters), FR-015/FR-016.
 */
export const listTransactionsQuerySchema = z.object({
  assetId: z.string().min(1).optional(),
  type: z.enum(["BUY", "SELL"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
