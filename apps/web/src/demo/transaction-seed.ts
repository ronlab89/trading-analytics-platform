import type { Actor, Clock, TransactionService } from "@trading/application";
import { Money, TransactionType } from "@trading/domain";
import type { AssetRepository, Portfolio } from "@trading/domain";

interface SeedPurchase {
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  /** How long before "now" the purchase happened. */
  readonly daysAgo: number;
}

const SEED_PURCHASES: readonly SeedPurchase[] = [
  { symbol: "AAPL", quantity: 20, price: 172.4, daysAgo: 25 },
  { symbol: "MSFT", quantity: 8, price: 402.1, daysAgo: 18 },
  { symbol: "BTC", quantity: 0.25, price: 61800, daysAgo: 10 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TransactionSeedDependencies {
  readonly transactionService: TransactionService;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly actor: Actor;
  readonly portfolio: Portfolio;
  readonly clock: Clock;
}

/** A few purchases through the real use case, so the portfolio opens with positions (full seed: FE4.2). */
export async function seedTransactions(dependencies: TransactionSeedDependencies): Promise<void> {
  const { transactionService, assetRepository, actor, portfolio, clock } = dependencies;

  for (const purchase of SEED_PURCHASES) {
    const asset = await assetRepository.getBySymbol(purchase.symbol);
    if (!asset) continue;
    await transactionService.createTransaction(actor, portfolio.id, {
      assetId: asset.id,
      type: TransactionType.BUY,
      quantity: purchase.quantity,
      price: Money.of(purchase.price.toFixed(2), portfolio.baseCurrency),
      executedAt: new Date(clock.now().getTime() - purchase.daysAgo * DAY_MS),
    });
  }
}
