import type { Actor, Clock, TransactionService } from "@trading/application";
import { Money, TransactionType } from "@trading/domain";
import type { AssetRepository, Portfolio, PortfolioRepository } from "@trading/domain";

interface SeedTrade {
  readonly type: TransactionType;
  readonly symbol: string;
  readonly quantity: number;
  readonly price: number;
  /** How long before "now" the trade happened. */
  readonly daysAgo: number;
}

interface SeedPortfolio {
  readonly name: string;
  readonly baseCurrency: string;
  readonly trades: readonly SeedTrade[];
}

const buy = (symbol: string, quantity: number, price: number, daysAgo: number): SeedTrade => ({
  type: TransactionType.BUY,
  symbol,
  quantity,
  price,
  daysAgo,
});

const sell = (symbol: string, quantity: number, price: number, daysAgo: number): SeedTrade => ({
  type: TransactionType.SELL,
  symbol,
  quantity,
  price,
  daysAgo,
});

/**
 * Every sale stays below what was bought before it, so the real use case never refuses a seed trade.
 * The first portfolio is the one the decisions are attached to.
 */
const SEED_PORTFOLIOS: readonly SeedPortfolio[] = [
  {
    name: "Long-term growth",
    baseCurrency: "USD",
    trades: [buy("AAPL", 20, 172.4, 25), buy("MSFT", 8, 402.1, 18), buy("BTC", 0.25, 61800, 10)],
  },
  {
    name: "Dividend income",
    baseCurrency: "USD",
    trades: [
      buy("SPY", 30, 480, 85),
      buy("MSFT", 10, 395, 70),
      buy("SPY", 15, 492, 40),
      sell("MSFT", 4, 418, 20),
      sell("SPY", 10, 503, 8),
    ],
  },
  {
    name: "Crypto",
    baseCurrency: "USD",
    trades: [
      buy("BTC", 0.5, 58200, 80),
      buy("ETH", 4, 3050, 65),
      buy("ETH", 2, 3320, 35),
      sell("BTC", 0.2, 64100, 15),
      sell("ETH", 1, 3580, 6),
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TransactionSeedDependencies {
  readonly portfolioRepository: Pick<PortfolioRepository, "create">;
  readonly transactionService: TransactionService;
  readonly assetRepository: Pick<AssetRepository, "getBySymbol">;
  readonly actor: Actor;
  readonly clock: Clock;
}

/**
 * Creates the demo portfolios and fills them through the real use case, dated from the injected clock
 * so the same clock always gives the same history. Returns them in seed order.
 */
export async function seedPortfolios(
  dependencies: TransactionSeedDependencies,
): Promise<Portfolio[]> {
  const { portfolioRepository, transactionService, assetRepository, actor, clock } = dependencies;
  const portfolios: Portfolio[] = [];

  for (const seed of SEED_PORTFOLIOS) {
    const portfolio = await portfolioRepository.create({
      userId: actor.userId,
      name: seed.name,
      baseCurrency: seed.baseCurrency,
    });
    portfolios.push(portfolio);

    for (const trade of seed.trades) {
      const asset = await assetRepository.getBySymbol(trade.symbol);
      if (!asset) continue;
      await transactionService.createTransaction(actor, portfolio.id, {
        assetId: asset.id,
        type: trade.type,
        quantity: trade.quantity,
        price: Money.of(trade.price.toFixed(2), portfolio.baseCurrency),
        executedAt: new Date(clock.now().getTime() - trade.daysAgo * DAY_MS),
      });
    }
  }

  return portfolios;
}
