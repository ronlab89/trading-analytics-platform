import {
  createAssetService,
  createIdempotencyService,
  createMarketService,
  createPortfolioService,
  createPositionService,
  createTransactionService,
  createUserPreferenceService,
  createWatchlistService,
} from "@trading/application";
import type { Actor, Clock } from "@trading/application";
import { UserRole } from "@trading/domain";
import {
  InMemoryAlertRepository,
  InMemoryAssetRepository,
  InMemoryHistoricalPriceRepository,
  InMemoryIdempotencyKeyRepository,
  InMemoryJobRepository,
  InMemoryMarketPriceRepository,
  InMemoryNotificationRepository,
  InMemoryPortfolioRepository,
  InMemoryPositionRepository,
  InMemoryTransactionRepository,
  InMemoryUnitOfWork,
  InMemoryUserPreferenceRepository,
  InMemoryWatchlistItemRepository,
} from "@trading/persistence-memory";
import { seedMarket } from "./market-seed";
import { seedTransactions } from "./transaction-seed";

export interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface DemoComposition {
  readonly user: DemoUser;
  readonly actor: Actor;
  readonly portfolioService: ReturnType<typeof createPortfolioService>;
  readonly assetService: ReturnType<typeof createAssetService>;
  readonly marketService: ReturnType<typeof createMarketService>;
  readonly watchlistService: ReturnType<typeof createWatchlistService>;
  readonly userPreferenceService: ReturnType<typeof createUserPreferenceService>;
  readonly transactionService: ReturnType<typeof createTransactionService>;
  readonly positionService: ReturnType<typeof createPositionService>;
  readonly idempotencyService: ReturnType<typeof createIdempotencyService>;
}

export interface DemoCompositionOptions {
  readonly clock?: Clock;
}

const DEMO_USER: DemoUser = {
  id: "demo-user",
  email: "demo@example.com",
  displayName: "Demo Trader",
  role: UserRole.TRADER,
};

/**
 * Wires the same application services as the API over the in-memory repositories (ADR-012 point 1).
 * It is the only place of the demo that knows which implementations back the ports. The state is
 * built again on every call, so a reset is a new composition.
 */
export async function createDemoComposition(
  options: DemoCompositionOptions = {},
): Promise<DemoComposition> {
  const clock = options.clock ?? { now: () => new Date() };
  const repositoryOptions = { now: () => clock.now() };
  const actor: Actor = { userId: DEMO_USER.id, role: DEMO_USER.role };

  const portfolioRepository = new InMemoryPortfolioRepository(repositoryOptions);
  const assetRepository = new InMemoryAssetRepository();
  const marketPriceRepository = new InMemoryMarketPriceRepository();
  const historicalPriceRepository = new InMemoryHistoricalPriceRepository(repositoryOptions);
  const transactionRepository = new InMemoryTransactionRepository(repositoryOptions);
  const positionRepository = new InMemoryPositionRepository(repositoryOptions);
  const idempotencyKeyRepository = new InMemoryIdempotencyKeyRepository(repositoryOptions);
  const unitOfWork = new InMemoryUnitOfWork({
    transactions: transactionRepository,
    positions: positionRepository,
    jobs: new InMemoryJobRepository(repositoryOptions),
    idempotencyKeys: idempotencyKeyRepository,
    alerts: new InMemoryAlertRepository(repositoryOptions),
    notifications: new InMemoryNotificationRepository(repositoryOptions),
  });

  const portfolio = await portfolioRepository.create({
    userId: DEMO_USER.id,
    name: "Long-term growth",
    baseCurrency: "USD",
  });
  await seedMarket(
    { assetRepository, marketPriceRepository, historicalPriceRepository },
    clock.now(),
  );

  const portfolioService = createPortfolioService({ portfolioRepository });
  const assetService = createAssetService({ assetRepository });
  const transactionService = createTransactionService({
    transactionRepository,
    assetRepository,
    unitOfWork,
    portfolioService,
    clock,
  });
  await seedTransactions({ transactionService, assetRepository, actor, portfolio, clock });

  return {
    user: DEMO_USER,
    actor,
    portfolioService,
    assetService,
    marketService: createMarketService({
      assetRepository,
      marketPriceRepository,
      historicalPriceRepository,
    }),
    watchlistService: createWatchlistService({
      watchlistRepository: new InMemoryWatchlistItemRepository(repositoryOptions),
      assetService,
    }),
    userPreferenceService: createUserPreferenceService({
      userPreferenceRepository: new InMemoryUserPreferenceRepository(repositoryOptions),
      portfolioService,
    }),
    transactionService,
    positionService: createPositionService({ positionRepository, portfolioService }),
    idempotencyService: createIdempotencyService({ idempotencyKeyRepository, clock }),
  };
}
