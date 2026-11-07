import {
  createAlertService,
  createAnalyticsService,
  createAssetService,
  createCsvImportHandler,
  createDecisionService,
  createIdempotencyService,
  createJobNotifier,
  createJobRunner,
  createJobService,
  createMarketService,
  createNotificationService,
  createOverviewService,
  createPerformanceService,
  createPortfolioService,
  createPositionService,
  createRangeAttributionService,
  createRiskService,
  createScenarioService,
  createSimulationService,
  createTransactionService,
  createUserPreferenceService,
  createWatchlistService,
} from "@trading/application";
import type { Actor, Clock } from "@trading/application";
import { UserRole } from "@trading/domain";
import {
  InMemoryAlertRepository,
  InMemoryAssetRepository,
  InMemoryDecisionEventRepository,
  InMemoryDecisionRepository,
  InMemoryHistoricalPriceRepository,
  InMemoryIdempotencyKeyRepository,
  InMemoryJobRepository,
  InMemoryMarketPriceRepository,
  InMemoryNotificationRepository,
  InMemoryPortfolioRepository,
  InMemoryPositionRepository,
  InMemoryScenarioRepository,
  InMemoryTransactionRepository,
  InMemoryUnitOfWork,
  InMemoryUserPreferenceRepository,
  InMemoryWatchlistItemRepository,
} from "@trading/persistence-memory";
import { tokenizeCsv } from "./csv-tokenizer";
import { seedDecisions } from "./decision-seed";
import { seedMarket } from "./market-seed";
import { createDemoSimulationControl } from "./simulation-control";
import type { DemoSimulationControl } from "./simulation-control";
import { seedPortfolios } from "./transaction-seed";

export interface DemoUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
}

export interface DemoComposition {
  /** The signed-in demo user; the role follows `setRole`. */
  readonly user: DemoUser;
  /** Reads the role at each use, so a role change reaches every service call. */
  readonly actor: Actor;
  /** Switches the role of the demo user (the demo sign in picks it). */
  setRole: (role: UserRole) => void;
  readonly portfolioService: ReturnType<typeof createPortfolioService>;
  readonly assetService: ReturnType<typeof createAssetService>;
  readonly marketService: ReturnType<typeof createMarketService>;
  readonly watchlistService: ReturnType<typeof createWatchlistService>;
  readonly userPreferenceService: ReturnType<typeof createUserPreferenceService>;
  readonly transactionService: ReturnType<typeof createTransactionService>;
  readonly positionService: ReturnType<typeof createPositionService>;
  readonly idempotencyService: ReturnType<typeof createIdempotencyService>;
  readonly analyticsService: ReturnType<typeof createAnalyticsService>;
  readonly overviewService: ReturnType<typeof createOverviewService>;
  readonly riskService: ReturnType<typeof createRiskService>;
  readonly performanceService: ReturnType<typeof createPerformanceService>;
  readonly rangeAttributionService: ReturnType<typeof createRangeAttributionService>;
  readonly decisionService: ReturnType<typeof createDecisionService>;
  readonly scenarioService: ReturnType<typeof createScenarioService>;
  readonly alertService: ReturnType<typeof createAlertService>;
  readonly notificationService: ReturnType<typeof createNotificationService>;
  readonly simulationService: ReturnType<typeof createSimulationService>;
  readonly simulationControl: DemoSimulationControl;
  readonly jobService: ReturnType<typeof createJobService>;
  /** Created stopped; the runtime starts it, and tests start it when they need a job to run. */
  readonly jobRunner: ReturnType<typeof createJobRunner>;
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
  const identity = { role: DEMO_USER.role };
  const actor: Actor = {
    userId: DEMO_USER.id,
    get role() {
      return identity.role;
    },
  };
  const user: DemoUser = {
    ...DEMO_USER,
    get role() {
      return identity.role;
    },
  };

  const portfolioRepository = new InMemoryPortfolioRepository(repositoryOptions);
  const assetRepository = new InMemoryAssetRepository();
  const marketPriceRepository = new InMemoryMarketPriceRepository();
  const historicalPriceRepository = new InMemoryHistoricalPriceRepository(repositoryOptions);
  const transactionRepository = new InMemoryTransactionRepository(repositoryOptions);
  const positionRepository = new InMemoryPositionRepository(repositoryOptions);
  const idempotencyKeyRepository = new InMemoryIdempotencyKeyRepository(repositoryOptions);
  const jobRepository = new InMemoryJobRepository(repositoryOptions);
  const notificationRepository = new InMemoryNotificationRepository(repositoryOptions);
  const alertRepository = new InMemoryAlertRepository(repositoryOptions);
  const decisionRepository = new InMemoryDecisionRepository(repositoryOptions);
  const decisionEventRepository = new InMemoryDecisionEventRepository(repositoryOptions);
  const scenarioRepository = new InMemoryScenarioRepository(repositoryOptions);
  const unitOfWork = new InMemoryUnitOfWork({
    transactions: transactionRepository,
    positions: positionRepository,
    jobs: jobRepository,
    idempotencyKeys: idempotencyKeyRepository,
    alerts: alertRepository,
    notifications: notificationRepository,
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
  const [portfolio] = await seedPortfolios({
    portfolioRepository,
    transactionService,
    assetRepository,
    actor,
    clock,
  });
  if (!portfolio) throw new Error("The demo seed produced no portfolio");

  await seedDecisions({
    decisionRepository,
    decisionEventRepository,
    assetRepository,
    portfolio,
    clock,
  });

  const seriesDependencies = {
    portfolioService,
    transactionRepository,
    historicalPriceRepository,
    clock,
  };

  const simulationControl = createDemoSimulationControl();
  const jobService = createJobService({ jobRepository, portfolioService, unitOfWork, clock });
  const jobRunner = createJobRunner({
    jobRepository,
    handlers: {
      CSV_IMPORT: createCsvImportHandler({
        tokenize: tokenizeCsv,
        portfolioRepository,
        assetRepository,
        transactionRepository,
        unitOfWork,
        clock,
      }),
    },
    clock,
    notifier: createJobNotifier({ notificationRepository }),
  });

  return {
    user,
    actor,
    setRole: (role) => {
      identity.role = role;
    },
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
    analyticsService: createAnalyticsService({
      positionRepository,
      portfolioService,
      assetService,
    }),
    overviewService: createOverviewService({
      positionRepository,
      transactionRepository,
      marketPriceRepository,
      historicalPriceRepository,
      portfolioService,
      assetService,
      clock,
    }),
    riskService: createRiskService(seriesDependencies),
    performanceService: createPerformanceService(seriesDependencies),
    rangeAttributionService: createRangeAttributionService({
      ...seriesDependencies,
      assetService,
    }),
    decisionService: createDecisionService({
      decisionRepository,
      decisionEventRepository,
      assetRepository,
      portfolioService,
    }),
    scenarioService: createScenarioService({
      scenarioRepository,
      positionRepository,
      portfolioService,
      assetService,
    }),
    alertService: createAlertService({
      alertRepository,
      marketPriceRepository,
      assetService,
      portfolioService,
    }),
    notificationService: createNotificationService({ notificationRepository, clock }),
    simulationService: createSimulationService({ control: simulationControl }),
    simulationControl,
    jobService,
    jobRunner,
  };
}
