/**
 * HistoricalPrice entity.
 * Source: docs/05-data-model.md §20
 *
 * Represents historical OHLCV market observations, supporting charting
 * and historical analysis. Has no `id` field in the data model — it is
 * identified by the (assetId, timestamp) pair.
 */
export interface HistoricalPrice {
  readonly assetId: string;
  readonly timestamp: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
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

export function validateNewHistoricalPrice(input: CreateHistoricalPriceInput): void {
  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidHistoricalPriceError("A historical price must reference an asset.");
  }

  if (input.open <= 0 || input.high <= 0 || input.low <= 0 || input.close <= 0) {
    throw new InvalidHistoricalPriceError("OHLC values must be greater than zero.");
  }

  if (input.high < input.low) {
    throw new InvalidHistoricalPriceError("High cannot be lower than low.");
  }

  if (input.high < input.open || input.high < input.close) {
    throw new InvalidHistoricalPriceError("High must be greater than or equal to open and close.");
  }

  if (input.low > input.open || input.low > input.close) {
    throw new InvalidHistoricalPriceError("Low must be less than or equal to open and close.");
  }

  if (input.volume < 0) {
    throw new InvalidHistoricalPriceError("Volume cannot be negative.");
  }
}
