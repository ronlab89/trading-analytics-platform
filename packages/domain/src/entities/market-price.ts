import type { Money } from "../value-objects/money";
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
 *
 * `price`, `previousPrice` and `change` are `Money` (see §39, "Monetary
 * Precision" and 04-tech-stack.md §28.1). `changePercent` remains a
 * plain `number` — it is a ratio, not a currency amount.
 *
 * There is no standalone top-level `currency` field: the market price's
 * currency is carried by `price.currency`, and `previousPrice.currency`
 * / `change.currency` must match it — a single market price cannot mix
 * currencies across its own fields.
 *
 * Whether `change` is mathematically consistent with
 * `price - previousPrice` is a calculation concern, not a structural
 * invariant, and is intentionally out of scope here (see
 * 06-architecture.md §10 — domain calculations module).
 */
export interface MarketPrice {
  readonly assetId: string;
  readonly price: Money;
  readonly previousPrice: Money;
  readonly change: Money;
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

  if (!input.price.isPositive()) {
    throw new InvalidMarketPriceError("Price must be greater than zero.");
  }

  if (!input.previousPrice.isPositive()) {
    throw new InvalidMarketPriceError("Previous price must be greater than zero.");
  }

  if (input.previousPrice.currency !== input.price.currency) {
    throw new InvalidMarketPriceError("Previous price currency must match the price currency.");
  }

  if (input.change.currency !== input.price.currency) {
    throw new InvalidMarketPriceError("Change currency must match the price currency.");
  }

  if (!Object.values(MarketDataSource).includes(input.source)) {
    throw new InvalidMarketPriceError(`Unsupported market data source: ${input.source}`);
  }
}
