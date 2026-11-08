import type { HistoricalPrice, Money } from "@trading/domain";
import { generateDayCandle, utcDay, utcDayStart, VOLUME_PER_TICK } from "./candles.js";
import type { Clock } from "./clock.js";
import { MarketMode, modeProfile } from "./mode.js";
import { stepPrice } from "./price-step.js";
import { createRandom } from "./random.js";
import type { Random } from "./random.js";
import { scenarioDefinition, scenarioDuration, scenarioProfileAt } from "./scenario.js";
import type { ScenarioDefinition, SimulationScenario } from "./scenario.js";

/** The starting state of one asset. */
export interface AssetSeed {
  readonly assetId: string;
  /** The current price. */
  readonly price: Money;
  /** The close of the last daily candle: `change` and `changePercent` are measured against it. */
  readonly previousClose: Money;
  /** The last sequence already used for this asset; the next tick is `sequence + 1`. Default 0. */
  readonly sequence?: number;
  /**
   * When the last daily candle of this asset was stored. The days after it, up to yesterday, are
   * generated when the engine starts, so the daily series has no gaps. Without it nothing is
   * backfilled.
   */
  readonly lastCandleAt?: Date;
}

export interface MarketEngineOptions {
  readonly clock: Clock;
  /** Same seed, mode, assets and clock produce the same ticks (NFR-045). */
  readonly seed: string | number;
  readonly assets: readonly AssetSeed[];
  /** Default `NORMAL`. */
  readonly mode?: MarketMode;
}

/**
 * One price tick of an asset (ADR-007 point 14). `previousPrice`, `change` and `changePercent`
 * are measured against the last closed daily candle; `tickChange` is the tick-to-tick delta.
 * `changePercent` is a percentage, for display only (ADR-002 point 3).
 */
export interface PriceTick {
  readonly assetId: string;
  readonly price: Money;
  readonly previousPrice: Money;
  readonly change: Money;
  readonly changePercent: number;
  readonly tickChange: Money;
  readonly sequence: number;
  readonly timestamp: Date;
}

/** Where a running scenario stands. */
export interface ScenarioProgress {
  readonly id: SimulationScenario;
  readonly elapsedTicks: number;
  readonly totalTicks: number;
}

export interface MarketEngine {
  mode(): MarketMode;
  setMode(mode: MarketMode): void;
  /** The running scenario, or `null` when none runs. */
  scenario(): ScenarioProgress | null;
  /**
   * Starts a scenario from the current prices. It replaces a running one and, until it ends or
   * `stopScenario` is called, sets the price movement instead of the mode.
   */
  startScenario(id: SimulationScenario): void;
  stopScenario(): void;
  /**
   * Advances every asset by one tick, in the order of `assets`. In `PAUSED` mode nothing moves:
   * it returns no ticks, uses no sequence and does not advance a running scenario.
   */
  tick(): PriceTick[];
  /**
   * The daily candles closed since the last call, oldest day first, then in the order of
   * `assets`. A candle closes when `tick` sees the clock enter a new UTC day, also in `PAUSED`
   * mode; the candles of days nobody ticked through are generated deterministically.
   */
  takeClosedCandles(): HistoricalPrice[];
}

export class InvalidSimulationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSimulationInputError";
  }
}

interface AssetState {
  readonly assetId: string;
  readonly random: Random;
  previousClose: Money;
  price: Money;
  sequence: number;
  /** The UTC day being accumulated into a candle. */
  day: number;
  open: Money;
  high: Money;
  low: Money;
  ticksInDay: number;
}

function validateAssets(assets: readonly AssetSeed[]): void {
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.assetId)) {
      throw new InvalidSimulationInputError(`Duplicate asset in the simulation: ${asset.assetId}.`);
    }
    seen.add(asset.assetId);
    if (!asset.price.isPositive() || !asset.previousClose.isPositive()) {
      throw new InvalidSimulationInputError(
        `Asset ${asset.assetId} needs a positive price and previous close.`,
      );
    }
    if (asset.price.currency !== asset.previousClose.currency) {
      throw new InvalidSimulationInputError(
        `Asset ${asset.assetId} mixes currencies between its price and previous close.`,
      );
    }
  }
}

export function createMarketEngine(options: MarketEngineOptions): MarketEngine {
  validateAssets(options.assets);

  let currentMode: MarketMode = options.mode ?? MarketMode.NORMAL;

  // Each asset draws from its own generator, so an asset's series does not depend on which
  // other assets run alongside it.
  const today = utcDay(options.clock.now());
  const states: AssetState[] = options.assets.map((asset) => ({
    assetId: asset.assetId,
    random: createRandom(`${String(options.seed)}:${asset.assetId}`),
    previousClose: asset.previousClose,
    price: asset.price,
    sequence: asset.sequence ?? 0,
    day: asset.lastCandleAt ? Math.min(utcDay(asset.lastCandleAt) + 1, today) : today,
    open: asset.price,
    high: asset.price,
    low: asset.price,
    ticksInDay: 0,
  }));

  let closedCandles: HistoricalPrice[] = [];

  // Closes every day before `until`: the day with ticks from what they did, any other day from
  // the generated walk. The close becomes the price and the previous close of the next day.
  const closeDaysBefore = (until: number): void => {
    const closed: HistoricalPrice[] = [];
    for (const state of states) {
      while (state.day < until) {
        const candle: HistoricalPrice =
          state.ticksInDay > 0
            ? {
                assetId: state.assetId,
                timestamp: utcDayStart(state.day),
                open: state.open,
                high: state.high,
                low: state.low,
                close: state.price,
                volume: state.ticksInDay * VOLUME_PER_TICK,
              }
            : generateDayCandle({
                seed: options.seed,
                assetId: state.assetId,
                day: state.day,
                open: state.price,
              });
        closed.push(candle);
        state.previousClose = candle.close;
        state.price = candle.close;
        state.open = candle.close;
        state.high = candle.close;
        state.low = candle.close;
        state.ticksInDay = 0;
        state.day += 1;
      }
    }
    // Oldest day first; the sort is stable, so assets keep their order within a day.
    closed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    closedCandles = closedCandles.concat(closed);
  };

  closeDaysBefore(today);

  let active: { definition: ScenarioDefinition; elapsed: number } | null = null;

  return {
    mode: () => currentMode,
    setMode: (mode) => {
      currentMode = mode;
    },
    scenario: () =>
      active
        ? {
            id: active.definition.id,
            elapsedTicks: active.elapsed,
            totalTicks: scenarioDuration(active.definition),
          }
        : null,
    startScenario: (id) => {
      active = { definition: scenarioDefinition(id), elapsed: 0 };
    },
    stopScenario: () => {
      active = null;
    },
    takeClosedCandles: () => {
      const taken = closedCandles;
      closedCandles = [];
      return taken;
    },
    tick: () => {
      const timestamp = options.clock.now();
      closeDaysBefore(utcDay(timestamp));
      if (currentMode === MarketMode.PAUSED) {
        return [];
      }
      const scenarioProfile = active ? scenarioProfileAt(active.definition, active.elapsed) : null;
      const profile = scenarioProfile ?? modeProfile(currentMode);
      if (active) {
        active.elapsed += 1;
        // The scenario ends with the tick that uses its last phase tick.
        if (active.elapsed >= scenarioDuration(active.definition)) {
          active = null;
        }
      }
      return states.map((state) => {
        const next = stepPrice(state.price, profile, state.random);
        const tickChange = next.subtract(state.price);
        const change = next.subtract(state.previousClose);
        state.price = next;
        state.sequence += 1;
        state.ticksInDay += 1;
        if (next.greaterThan(state.high)) {
          state.high = next;
        }
        if (next.lessThan(state.low)) {
          state.low = next;
        }
        return {
          assetId: state.assetId,
          price: next,
          previousPrice: state.previousClose,
          change,
          changePercent: (change.toNumber() / state.previousClose.toNumber()) * 100,
          tickChange,
          sequence: state.sequence,
          timestamp,
        };
      });
    },
  };
}
