import { publishQuietly } from "@trading/application";
import type {
  Clock,
  Logger,
  RealtimePublisher,
  SimulationControl,
  SimulationMode,
  SimulationState,
  SimulationStatus,
} from "@trading/application";
import {
  AssetStatus,
  MarketDataSource,
  validateNewMarketEvent,
  validateNewMarketPrice,
} from "@trading/domain";
import type {
  AssetRepository,
  HistoricalPrice,
  HistoricalPriceRepository,
  MarketEventRepository,
  MarketPriceRepository,
  PositionRepository,
} from "@trading/domain";
import { createMarketEngine } from "@trading/market-sim";
import type { AssetSeed, MarketEngine, PriceTick } from "@trading/market-sim";
import { LOG_EVENTS } from "../logging/events.js";
import { intervalScheduler } from "./scheduler.js";
import type { ScheduledTask, Scheduler } from "./scheduler.js";

/** The simulator ticks every second (ADR-007 point 15). */
export const TICK_INTERVAL_MS = 1_000;

/** Events kept per asset: one hour at one tick per second (B5.6 decision D5). */
export const EVENT_RETENTION = 3_600;

/** Ticks between two prunes of the old events (B5.6 decision D5). */
export const PRUNE_EVERY_TICKS = 300;

const BASE_SEED = "trading-analytics-platform";
const ASSET_PAGE_SIZE = 100;

export interface MarketSimulatorDependencies {
  clock: Clock;
  logger: Logger;
  publisher: RealtimePublisher;
  assetRepository: Pick<AssetRepository, "list">;
  marketPriceRepository: Pick<MarketPriceRepository, "listByAssetIds" | "upsert">;
  marketEventRepository: Pick<
    MarketEventRepository,
    "getLastSequence" | "create" | "pruneBeforeSequence"
  >;
  historicalPriceRepository: Pick<HistoricalPriceRepository, "getLatestByAssetId" | "create">;
  positionRepository: Pick<PositionRepository, "updateCurrentPriceByAssetId">;
  /** Defaults to a real timer; tests pass one they fire by hand. */
  scheduler?: Scheduler;
  /** Defaults to `EVENT_RETENTION`. */
  eventRetention?: number;
  /** Defaults to `PRUNE_EVERY_TICKS`. */
  pruneEveryTicks?: number;
}

export interface MarketSimulator extends SimulationControl {
  status: () => SimulationStatus;
  /**
   * Starts from the persisted state and, unless it was halted before, begins to
   * tick. It never rejects: a failure is logged and the API runs without prices
   * moving (realtime is best effort, ADR-007 point 12).
   */
  boot: () => Promise<void>;
  /** Stops ticking and waits for the tick in flight (shutdown, ADR-006 point 12). */
  stop: () => Promise<void>;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/**
 * The server market simulator: it drives the `@trading/market-sim` engine every
 * second and writes its output (ADR-007 points 7, 8, 14 and 16).
 *
 * Each tick, per asset, updates `MarketPrice` and the `Position.currentPrice`
 * of its holders, appends a `MarketEvent` with the next sequence and publishes
 * `MARKET_PRICE_UPDATED`. Closed daily candles are stored before the prices of
 * the tick. The engine starts from the persisted `MarketPrice` and the highest
 * `MarketEvent.sequence` of each asset, so a restart resumes without a gap.
 *
 * One failing asset does not stop the others and a failing tick does not stop
 * the loop; a tick that is still running makes the next one be skipped.
 */
export function createMarketSimulator(dependencies: MarketSimulatorDependencies): MarketSimulator {
  const {
    clock,
    logger,
    publisher,
    assetRepository,
    marketPriceRepository,
    marketEventRepository,
    historicalPriceRepository,
    positionRepository,
    scheduler = intervalScheduler,
    eventRetention = EVENT_RETENTION,
    pruneEveryTicks = PRUNE_EVERY_TICKS,
  } = dependencies;

  let state: SimulationState = "RUNNING";
  let mode: SimulationMode = "NORMAL";
  let engine: MarketEngine | null = null;
  let timer: ScheduledTask | null = null;
  let stopped = false;
  let booting = false;
  let bootFailed = false;
  let ticking = false;
  let inFlight: Promise<void> = Promise.resolve();
  let ticksSincePrune = 0;
  // Closed candles wait here until they are stored, so a failed write is retried on the next tick.
  const pendingCandles: HistoricalPrice[] = [];

  const status = (): SimulationStatus => ({ state, mode });

  async function listActiveAssetIds(): Promise<string[]> {
    const ids: string[] = [];
    for (let page = 1; ; page += 1) {
      const result = await assetRepository.list(
        { status: AssetStatus.ACTIVE },
        { page, pageSize: ASSET_PAGE_SIZE },
      );
      ids.push(...result.items.map((asset) => asset.id));
      if (result.items.length === 0 || ids.length >= result.total) {
        return ids;
      }
    }
  }

  // An asset without a `MarketPrice` has no price to start from, so it does not move.
  async function loadSeeds(): Promise<{ assets: AssetSeed[]; highestSequence: number }> {
    const prices = await marketPriceRepository.listByAssetIds(await listActiveAssetIds());
    const assets: AssetSeed[] = [];
    let highestSequence = 0;
    for (const market of [...prices].sort((a, b) => a.assetId.localeCompare(b.assetId))) {
      const lastSequence = await marketEventRepository.getLastSequence(market.assetId);
      const latestCandle = await historicalPriceRepository.getLatestByAssetId(market.assetId);
      highestSequence = Math.max(highestSequence, lastSequence ?? 0);
      assets.push({
        assetId: market.assetId,
        price: market.price,
        previousClose: market.previousPrice,
        ...(lastSequence !== null ? { sequence: lastSequence } : {}),
        ...(latestCandle ? { lastCandleAt: latestCandle.timestamp } : {}),
      });
    }
    return { assets, highestSequence };
  }

  // Stores the closed candles in order and stops at the first failure, keeping the rest for later.
  async function storeClosedCandles(): Promise<HistoricalPrice[]> {
    const stored: HistoricalPrice[] = [];
    for (const candle of [...pendingCandles]) {
      try {
        await historicalPriceRepository.create(candle);
      } catch (error) {
        logger.warn(LOG_EVENTS.simulationCandleFailed, {
          assetId: candle.assetId,
          day: candle.timestamp.toISOString().slice(0, 10),
          errorName: errorName(error),
        });
        break;
      }
      pendingCandles.shift();
      stored.push(candle);
    }
    return stored;
  }

  // An asset that did not tick (the mode is PAUSED, or the server was offline) still has to move
  // its previous price to the close of the day that just ended (ADR-007 point 8).
  async function rollWithoutTick(stored: HistoricalPrice[], ticked: ReadonlySet<string>) {
    const lastClose = new Map<string, HistoricalPrice>();
    for (const candle of stored) {
      lastClose.set(candle.assetId, candle);
    }
    for (const [assetId, candle] of lastClose) {
      if (ticked.has(assetId)) {
        continue;
      }
      try {
        const price = {
          assetId,
          price: candle.close,
          previousPrice: candle.close,
          change: candle.close.subtract(candle.close),
          changePercent: 0,
          source: MarketDataSource.MOCK,
          timestamp: clock.now(),
        };
        validateNewMarketPrice(price);
        await marketPriceRepository.upsert(price);
        await positionRepository.updateCurrentPriceByAssetId(assetId, candle.close);
      } catch (error) {
        logger.warn(LOG_EVENTS.simulationTickFailed, { assetId, errorName: errorName(error) });
      }
    }
  }

  async function applyTick(tick: PriceTick): Promise<void> {
    try {
      const market = {
        assetId: tick.assetId,
        price: tick.price,
        previousPrice: tick.previousPrice,
        change: tick.change,
        changePercent: tick.changePercent,
        source: MarketDataSource.MOCK,
        timestamp: tick.timestamp,
      };
      validateNewMarketPrice(market);
      await marketPriceRepository.upsert(market);

      const event = { assetId: tick.assetId, price: tick.price, sequence: tick.sequence };
      validateNewMarketEvent(event);
      await marketEventRepository.create(event);

      await positionRepository.updateCurrentPriceByAssetId(tick.assetId, tick.price);
    } catch (error) {
      logger.warn(LOG_EVENTS.simulationTickFailed, {
        assetId: tick.assetId,
        sequence: tick.sequence,
        errorName: errorName(error),
      });
      return;
    }

    await publishQuietly(logger, "MARKET_PRICE_UPDATED", { assetId: tick.assetId }, () =>
      publisher.marketPriceUpdated(tick),
    );
  }

  async function pruneOldEvents(ticks: readonly PriceTick[]): Promise<void> {
    if (ticks.length === 0) {
      return;
    }
    ticksSincePrune += 1;
    if (ticksSincePrune < pruneEveryTicks) {
      return;
    }
    ticksSincePrune = 0;
    for (const tick of ticks) {
      try {
        await marketEventRepository.pruneBeforeSequence(
          tick.assetId,
          Math.max(0, tick.sequence - eventRetention + 1),
        );
      } catch (error) {
        logger.warn(LOG_EVENTS.simulationPruneFailed, {
          assetId: tick.assetId,
          errorName: errorName(error),
        });
      }
    }
  }

  async function settleCandles(ticked: ReadonlySet<string>): Promise<void> {
    const stored = await storeClosedCandles();
    await rollWithoutTick(stored, ticked);
  }

  async function tickOnce(current: MarketEngine): Promise<void> {
    try {
      const ticks = current.tick();
      pendingCandles.push(...current.takeClosedCandles());
      await settleCandles(new Set(ticks.map((tick) => tick.assetId)));
      for (const tick of ticks) {
        await applyTick(tick);
      }
      await pruneOldEvents(ticks);
    } catch (error) {
      logger.error(LOG_EVENTS.simulationTickFailed, { errorName: errorName(error) });
    }
  }

  // A tick that is still running makes the next call wait for it instead of starting another.
  function runTick(): Promise<void> {
    if (engine === null) {
      return Promise.resolve();
    }
    if (!ticking) {
      ticking = true;
      inFlight = tickOnce(engine).finally(() => {
        ticking = false;
      });
    }
    return inFlight;
  }

  function startTimer(): void {
    if (timer !== null || engine === null || stopped) {
      return;
    }
    timer = scheduler.every(TICK_INTERVAL_MS, runTick);
  }

  function stopTimer(): void {
    timer?.stop();
    timer = null;
  }

  async function boot(): Promise<void> {
    if (engine !== null || stopped || booting) {
      return;
    }
    booting = true;
    try {
      const { assets, highestSequence } = await loadSeeds();
      // The persisted position moves the seed, so a restart does not replay the same noise.
      engine = createMarketEngine({
        clock,
        seed: `${BASE_SEED}:${String(highestSequence)}`,
        assets,
        mode,
      });
      pendingCandles.push(...engine.takeClosedCandles());
      await settleCandles(new Set());
      bootFailed = false;
      if (state === "RUNNING") {
        startTimer();
        logger.info(LOG_EVENTS.simulationStarted, { mode, assetCount: assets.length });
      }
    } catch (error) {
      engine = null;
      bootFailed = true;
      logger.error(LOG_EVENTS.simulationBootFailed, { errorName: errorName(error) });
    } finally {
      booting = false;
    }
  }

  return {
    status,
    boot,

    start() {
      if (engine === null && bootFailed) {
        // A failed boot is retried here, so an ADMIN recovers without restarting the process;
        // the boot starts the timer and logs `simulation.started` once it succeeds.
        state = "RUNNING";
        void boot();
      } else if (state === "HALTED") {
        state = "RUNNING";
        startTimer();
        logger.info(LOG_EVENTS.simulationStarted, { mode });
      }
      return status();
    },

    pause() {
      if (state === "RUNNING") {
        state = "HALTED";
        stopTimer();
        logger.info(LOG_EVENTS.simulationPaused, { mode });
      }
      return status();
    },

    setMode(next) {
      if (next !== mode) {
        const previous = mode;
        mode = next;
        engine?.setMode(next);
        logger.info(LOG_EVENTS.simulationModeChanged, { from: previous, to: next });
      }
      return status();
    },

    async stop() {
      stopped = true;
      stopTimer();
      await inFlight;
    },
  };
}
