import type { Clock, Logger, RealtimePublisher } from "@trading/application";
import { AssetStatus, MarketDataSource, validateNewMarketPrice } from "@trading/domain";
import type {
  AssetRepository,
  HistoricalPrice,
  HistoricalPriceRepository,
  MarketPriceRepository,
  PositionRepository,
} from "@trading/domain";
import { createMarketEngine } from "@trading/market-sim";
import type { AssetSeed, MarketEngine, PriceTick } from "@trading/market-sim";
import type { DemoSimulationControl } from "./simulation-control";

/** The simulation ticks once per second (ADR-012 point 7). */
export const TICK_INTERVAL_MS = 1_000;

/** The same seed every run, so the same clock gives the same prices. */
const SIMULATION_SEED = "demo-market";

const ASSET_PAGE_SIZE = 100;

/** A repeating task that can be stopped; tests fire it by hand instead of waiting for real seconds. */
export interface Scheduler {
  every: (intervalMs: number, task: () => Promise<void>) => { stop: () => void };
}

const intervalScheduler: Scheduler = {
  every(intervalMs, task) {
    const handle = setInterval(() => {
      void task();
    }, intervalMs);
    return {
      stop: () => {
        clearInterval(handle);
      },
    };
  },
};

export interface DemoMarketSimulatorDependencies {
  readonly clock: Clock;
  /** The state and the mode set by the administrator; read at every tick. */
  readonly control: Pick<DemoSimulationControl, "status">;
  readonly publisher?: Pick<RealtimePublisher, "marketPriceUpdated">;
  readonly assetRepository: Pick<AssetRepository, "list">;
  readonly marketPriceRepository: Pick<MarketPriceRepository, "listByAssetIds" | "upsert">;
  readonly historicalPriceRepository: Pick<
    HistoricalPriceRepository,
    "getLatestByAssetId" | "create"
  >;
  readonly positionRepository: Pick<PositionRepository, "updateCurrentPriceByAssetId">;
  readonly logger?: Pick<Logger, "warn">;
  /** Defaults to a real timer. */
  readonly scheduler?: Scheduler;
  /** The simulation pauses while the browser tab is hidden (ADR-012 point 7). Defaults to always visible. */
  readonly isVisible?: () => boolean;
}

export interface DemoMarketSimulator {
  /** Reads the prices to start from and begins to tick. Calling it again does nothing. */
  start: () => Promise<void>;
  /** Stops ticking and waits for the tick in flight. */
  stop: () => Promise<void>;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

/**
 * The market simulator of the demo: it drives the `@trading/market-sim` engine every second and, per
 * asset, updates its `MarketPrice` and the current price of its positions and publishes
 * `MARKET_PRICE_UPDATED` (ADR-012 point 7). It is the in-browser counterpart of the API simulator,
 * without its event log or logger plumbing. The administrator's control decides whether it runs and
 * in which mode; it skips the ticks while the tab is hidden. One failing asset does not stop the
 * others, and a tick still running makes the next one be skipped.
 */
export function createDemoMarketSimulator(
  dependencies: DemoMarketSimulatorDependencies,
): DemoMarketSimulator {
  const {
    clock,
    control,
    publisher,
    assetRepository,
    marketPriceRepository,
    historicalPriceRepository,
    positionRepository,
    logger,
    scheduler = intervalScheduler,
    isVisible = () => true,
  } = dependencies;

  let engine: MarketEngine | null = null;
  let appliedMode = control.status().mode;
  let timer: { stop: () => void } | null = null;
  let stopped = false;
  // A function, so the checks after an `await` see a `stop()` that ran in the meantime.
  const isStopped = () => stopped;
  let starting = false;
  let ticking = false;
  let inFlight: Promise<void> = Promise.resolve();
  const pendingCandles: HistoricalPrice[] = [];

  async function listActiveAssets(): Promise<{ id: string; symbol: string }[]> {
    const assets: { id: string; symbol: string }[] = [];
    for (let page = 1; ; page += 1) {
      const result = await assetRepository.list(
        { status: AssetStatus.ACTIVE },
        { page, pageSize: ASSET_PAGE_SIZE },
      );
      assets.push(...result.items.map(({ id, symbol }) => ({ id, symbol })));
      if (result.items.length === 0 || assets.length >= result.total) return assets;
    }
  }

  // An asset without a `MarketPrice` has no price to start from, so it does not move. They go in
  // symbol order because the ids are random and the engine draws its numbers in the order it is given.
  async function loadSeeds(): Promise<AssetSeed[]> {
    const assets = await listActiveAssets();
    const symbolOf = new Map(assets.map((asset) => [asset.id, asset.symbol]));
    const prices = await marketPriceRepository.listByAssetIds(assets.map((asset) => asset.id));
    const seeds: AssetSeed[] = [];
    const bySymbol = [...prices].sort((a, b) =>
      (symbolOf.get(a.assetId) ?? "").localeCompare(symbolOf.get(b.assetId) ?? ""),
    );
    for (const market of bySymbol) {
      const latestCandle = await historicalPriceRepository.getLatestByAssetId(market.assetId);
      seeds.push({
        assetId: market.assetId,
        price: market.price,
        previousClose: market.previousPrice,
        ...(latestCandle ? { lastCandleAt: latestCandle.timestamp } : {}),
      });
    }
    return seeds;
  }

  // Stores the closed candles in order and keeps the rest for the next tick when one fails.
  async function storeClosedCandles(): Promise<void> {
    for (const candle of [...pendingCandles]) {
      try {
        await historicalPriceRepository.create(candle);
      } catch (error) {
        logger?.warn("demo.simulation.candle.failed", {
          assetId: candle.assetId,
          errorName: errorName(error),
        });
        return;
      }
      pendingCandles.shift();
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
      await positionRepository.updateCurrentPriceByAssetId(tick.assetId, tick.price);
    } catch (error) {
      logger?.warn("demo.simulation.tick.failed", {
        assetId: tick.assetId,
        errorName: errorName(error),
      });
      return;
    }

    try {
      await publisher?.marketPriceUpdated(tick);
    } catch (error) {
      logger?.warn("demo.simulation.publish.failed", {
        assetId: tick.assetId,
        errorName: errorName(error),
      });
    }
  }

  async function tickOnce(current: MarketEngine): Promise<void> {
    if (!isVisible()) return;
    const { state, mode } = control.status();
    if (state === "HALTED") return;
    if (mode !== appliedMode) {
      current.setMode(mode);
      appliedMode = mode;
    }

    const ticks = current.tick();
    pendingCandles.push(...current.takeClosedCandles());
    await storeClosedCandles();
    for (const tick of ticks) await applyTick(tick);
  }

  // A tick that is still running makes the next call wait for it instead of starting another.
  function runTick(): Promise<void> {
    if (engine === null) return Promise.resolve();
    if (!ticking) {
      ticking = true;
      inFlight = tickOnce(engine)
        .catch((error: unknown) => {
          logger?.warn("demo.simulation.tick.failed", { errorName: errorName(error) });
        })
        .finally(() => {
          ticking = false;
        });
    }
    return inFlight;
  }

  return {
    async start() {
      if (engine !== null || timer !== null || stopped || starting) return;
      starting = true;
      try {
        engine = createMarketEngine({
          clock,
          seed: SIMULATION_SEED,
          assets: await loadSeeds(),
          mode: appliedMode,
        });
        pendingCandles.push(...engine.takeClosedCandles());
        await storeClosedCandles();
        if (!isStopped()) timer = scheduler.every(TICK_INTERVAL_MS, runTick);
      } finally {
        starting = false;
      }
    },

    async stop() {
      stopped = true;
      timer?.stop();
      timer = null;
      await inFlight;
    },
  };
}
