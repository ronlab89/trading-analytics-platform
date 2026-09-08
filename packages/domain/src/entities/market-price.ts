import { MarketDataSource } from "./enums";

/**
 * MarketPrice entity.
 * Source: docs/05-data-model.md §18
 *
 * Represents the current known price of an asset. Unlike other
 * entities in this module, MarketPrice does not have an `id` of its
 * own in the data model — it is keyed by `assetId` (one current price
 * per asset), consistent with "Current asset price → Market Price"
 * as the source of truth (§31).
 */
export interface MarketPrice {
  readonly assetId: string;
  readonly price: number;
  readonly previousPrice: number;
  readonly change: number;
  readonly changePercent: number;
  readonly timestamp: Date;
  readonly source: MarketDataSource;
}

export type CreateMarketPriceInput = Pick<
  MarketPrice,
  "assetId" | "price" | "previousPrice" | "change" | "changePercent" | "source"
>;

export class InvalidMarketPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMarketPriceError";
  }
}

export function validateNewMarketPrice(input: CreateMarketPriceInput): void {
  if (!input.assetId || input.assetId.trim().length === 0) {
    throw new InvalidMarketPriceError("A market price must reference an asset.");
  }

  if (input.price <= 0) {
    throw new InvalidMarketPriceError("Price must be greater than zero.");
  }

  if (input.previousPrice <= 0) {
    throw new InvalidMarketPriceError("Previous price must be greater than zero.");
  }

  if (!Object.values(MarketDataSource).includes(input.source)) {
    throw new InvalidMarketPriceError(`Unsupported market data source: ${input.source}`);
  }
}
