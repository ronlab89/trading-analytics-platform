import { z } from "zod";

/**
 * Query parameters for GET /api/v1/market/prices (batch).
 * Source: 07-api-spec.md §19 (Market Data Batch Endpoint).
 *
 * `assetIds` arrives as a comma-separated string (standard for a
 * repeated-value query param passed this way); parsed into an array
 * here so the service/controller never touch raw query string parsing.
 */
export const batchPricesQuerySchema = z.object({
  assetIds: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string()).min(1).max(50)),
});

/**
 * Query parameters for GET /api/v1/assets/:assetId/history.
 * Source: 07-api-spec.md §18 (Historical Market Data), FR-026.
 *
 * `interval`: only "1d" is supported today, since the only data that
 * exists is daily candles (see seed/data/historical-prices.ts). Listed
 * as a single-value enum — rather than a free string — so requesting
 * an unsupported interval (e.g. "1h") fails validation with a clear
 * message instead of silently being ignored.
 */
export const assetHistoryQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    interval: z.enum(["1d"]).default("1d"),
  })
  .refine((value) => value.from <= value.to, {
    message: "'from' must not be after 'to'.",
    path: ["from"],
  });
