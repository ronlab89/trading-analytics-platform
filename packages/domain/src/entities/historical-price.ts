import type { Money } from "../value-objects/money";

/**
 * HistoricalPrice entity.
 * Source: docs/05-data-model.md §20
 *
 * Represents historical OHLCV market observations, supporting charting
 * and historical analysis. Has no `id` field in the data model — it is
 * identified by the (assetId, timestamp) pair.
 *
 * `open`, `high`, `low` and `close` are `Money` (see §39, "Monetary
 * Precision" and 04-tech-stack.md §28.1). `volume` remains a plain
 * `number` — it is a count of traded units, not a currency amount.
 *
 * There is no standalone `currency` field: a historical price's
 * currency is carried by `open.currency`, and `high`/`low`/`close`
 * must match it — a single OHLC observation cannot mix currencies
 * across its own fields.
 *
 * `Money` does not expose `>=`/`<=` operators directly — the OHLC
 * ordering invariants below compose `greaterThan`/`lessThan`/`equals`
 * inline rather than adding those operators to the shared value object.
 */
export interface HistoricalPrice {
  readonly assetId: string;
  readonly timestamp: Date;
  readonly open: Money;
  readonly high: Money;
  readonly low: Money;
  readonly close: Money;
  readonly volume: number;
}

export type CreateHistoricalPriceInput = Pick<
  HistoricalPrice,
  "assetId" | "open" | "high" | "low" | "close" | "volume"
> & { timestamp?: Date };

export class InvalidHistoricalPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHistoricalPriceError";
  }
}

function isGreaterOrEqual(a: Money, b: Money): boolean {
  return a.greaterThan(b) || a.equals(b);
}

function isLessOrEqual(a: Money, b: Money): boolean {
  return a.lessThan(b) || a.equals(b);
}

export function validateNewHistoricalPrice(input: CreateHistoricalPriceInput): void {
  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidHistoricalPriceError("A historical price must reference an asset.");
  }

  if (
    !input.open.isPositive() ||
    !input.high.isPositive() ||
    !input.low.isPositive() ||
    !input.close.isPositive()
  ) {
    throw new InvalidHistoricalPriceError("OHLC values must be greater than zero.");
  }

  const currency = input.open.currency;
  if (
    input.high.currency !== currency ||
    input.low.currency !== currency ||
    input.close.currency !== currency
  ) {
    throw new InvalidHistoricalPriceError("OHLC values must share the same currency.");
  }

  if (input.high.lessThan(input.low)) {
    throw new InvalidHistoricalPriceError("High cannot be lower than low.");
  }

  if (!isGreaterOrEqual(input.high, input.open) || !isGreaterOrEqual(input.high, input.close)) {
    throw new InvalidHistoricalPriceError("High must be greater than or equal to open and close.");
  }

  if (!isLessOrEqual(input.low, input.open) || !isLessOrEqual(input.low, input.close)) {
    throw new InvalidHistoricalPriceError("Low must be less than or equal to open and close.");
  }

  if (input.volume < 0) {
    throw new InvalidHistoricalPriceError("Volume cannot be negative.");
  }
}
