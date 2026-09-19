import { TransactionType, Money } from "@trading/domain";

export interface TransactionBlueprint {
  readonly type: TransactionType;
  readonly quantity: number;
  readonly price: Money;
  readonly fees?: Money;
  readonly executedAt: Date;
}

export interface PositionBlueprint {
  readonly portfolioName: string;
  readonly assetSymbol: string;
  readonly transactions: readonly TransactionBlueprint[];
  /**
   * Resulting position state, hand-computed from `transactions` above
   * using the average-cost method. Not derived at seed time by a
   * calculation engine — see Step 6.3 notes: no such derivation exists
   * yet in the domain layer (calculatePositionMetrics derives metrics
   * FROM a Position, not a Position FROM transaction history).
   */
  readonly quantity: number;
  readonly averageEntryPrice: Money;
  readonly currentPrice: Money;
}

/**
 * Source of the illustrative prices: reused directly from the SDDs'
 * own examples (07-api-spec.md §17 — AAPL 184.22; 01-product-spec.md
 * §16 — BTC 112,450.20) rather than inventing new figures, per
 * 12-demo-mode-spec.md §85 (no invented measurements/figures).
 */
export const SEED_POSITIONS: readonly PositionBlueprint[] = [
  // Main Portfolio — AAPL: clear winner (+22.8%)
  {
    portfolioName: "Main Portfolio",
    assetSymbol: "AAPL",
    transactions: [
      {
        type: TransactionType.BUY,
        quantity: 10,
        price: Money.of(150, "USD"),
        fees: Money.of(1.5, "USD"),
        executedAt: new Date("2026-06-01T14:30:00Z"),
      },
    ],
    quantity: 10,
    averageEntryPrice: Money.of(150, "USD"),
    currentPrice: Money.of(184.22, "USD"),
  },

  // Main Portfolio — MSFT: clear loser (-8.3%)
  {
    portfolioName: "Main Portfolio",
    assetSymbol: "MSFT",
    transactions: [
      {
        type: TransactionType.BUY,
        quantity: 5,
        price: Money.of(420, "USD"),
        fees: Money.of(2, "USD"),
        executedAt: new Date("2026-05-15T15:00:00Z"),
      },
    ],
    quantity: 5,
    averageEntryPrice: Money.of(420, "USD"),
    currentPrice: Money.of(385, "USD"),
  },

  // Main Portfolio — VOO: approximately flat (+0.2%)
  {
    portfolioName: "Main Portfolio",
    assetSymbol: "VOO",
    transactions: [
      {
        type: TransactionType.BUY,
        quantity: 8,
        price: Money.of(480, "USD"),
        fees: Money.of(1, "USD"),
        executedAt: new Date("2026-04-10T13:45:00Z"),
      },
    ],
    quantity: 8,
    averageEntryPrice: Money.of(480, "USD"),
    currentPrice: Money.of(481, "USD"),
  },

  // Crypto Experimental — BTC: big winner (+87%), includes a partial sell.
  // Average-cost method: selling 0.01 of 0.05 does not change the average
  // entry price, it only reduces quantity (0.05 - 0.01 = 0.04).
  {
    portfolioName: "Crypto Experimental",
    assetSymbol: "BTC",
    transactions: [
      {
        type: TransactionType.BUY,
        quantity: 0.05,
        price: Money.of(60000, "USD"),
        fees: Money.of(15, "USD"),
        executedAt: new Date("2026-03-01T10:00:00Z"),
      },
      {
        type: TransactionType.SELL,
        quantity: 0.01,
        price: Money.of(65000, "USD"),
        fees: Money.of(5, "USD"),
        executedAt: new Date("2026-07-01T16:20:00Z"),
      },
    ],
    quantity: 0.04,
    averageEntryPrice: Money.of(60000, "USD"),
    currentPrice: Money.of(112450.2, "USD"),
  },

  // Crypto Experimental — ETH: mild loser (-3.1%)
  {
    portfolioName: "Crypto Experimental",
    assetSymbol: "ETH",
    transactions: [
      {
        type: TransactionType.BUY,
        quantity: 2,
        price: Money.of(3200, "USD"),
        fees: Money.of(3, "USD"),
        executedAt: new Date("2026-02-15T09:30:00Z"),
      },
    ],
    quantity: 2,
    averageEntryPrice: Money.of(3200, "USD"),
    currentPrice: Money.of(3100, "USD"),
  },

  // "Empty Portfolio" intentionally has no entry here — it stays empty.
];
