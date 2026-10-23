import type { Money } from "@trading/domain";
import type { Clock } from "./clock";
import { MarketMode, modeProfile } from "./mode";
import { stepPrice } from "./price-step";
import { createRandom } from "./random";
import type { Random } from "./random";
import { scenarioDefinition, scenarioDuration, scenarioProfileAt } from "./scenario";
import type { ScenarioDefinition, SimulationScenario } from "./scenario";

/** The starting state of one asset. */
export interface AssetSeed {
  readonly assetId: string;
  /** The current price. */
  readonly price: Money;
  /** The close of the last daily candle: `change` and `changePercent` are measured against it. */
  readonly previousClose: Money;
  /** The last sequence already used for this asset; the next tick is `sequence + 1`. Default 0. */
  readonly sequence?: number;
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
}

export class InvalidSimulationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSimulationInputError";
  }
}

interface AssetState {
  readonly assetId: string;
  readonly previousClose: Money;
  readonly random: Random;
  price: Money;
  sequence: number;
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
  const states: AssetState[] = options.assets.map((asset) => ({
    assetId: asset.assetId,
    previousClose: asset.previousClose,
    random: createRandom(`${String(options.seed)}:${asset.assetId}`),
    price: asset.price,
    sequence: asset.sequence ?? 0,
  }));

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
    tick: () => {
      if (currentMode === MarketMode.PAUSED) {
        return [];
      }
      const scenarioProfile = active ? scenarioProfileAt(active.definition, active.elapsed) : null;
      const profile = scenarioProfile ?? modeProfile(currentMode);
      if (active) {
        active.elapsed += 1;
        if (scenarioProfileAt(active.definition, active.elapsed) === null) {
          active = null;
        }
      }
      const timestamp = options.clock.now();
      return states.map((state) => {
        const next = stepPrice(state.price, profile, state.random);
        const tickChange = next.subtract(state.price);
        const change = next.subtract(state.previousClose);
        state.price = next;
        state.sequence += 1;
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
