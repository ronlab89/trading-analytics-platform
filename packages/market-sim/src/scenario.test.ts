import { Money } from "@trading/domain";
import { describe, expect, it } from "vitest";
import { createMarketEngine } from "./engine.js";
import type { MarketEngine, PriceTick } from "./engine.js";
import { MarketMode } from "./mode.js";
import {
  scenarioDefinition,
  scenarioDuration,
  scenarioProfileAt,
  SimulationScenario,
} from "./scenario.js";

const clock = { now: () => new Date("2026-10-23T14:30:00.000Z") };
const START = 100;

function engineFor(seed: string, mode?: MarketMode, price = "100.00"): MarketEngine {
  return createMarketEngine({
    clock,
    seed,
    ...(mode ? { mode } : {}),
    assets: [
      { assetId: "a", price: Money.of(price, "USD"), previousClose: Money.of(price, "USD") },
    ],
  });
}

function priceOf(ticks: PriceTick[]): number {
  const tick = ticks[0];
  if (!tick) {
    throw new Error("Expected the engine to return a tick.");
  }
  return tick.price.toNumber();
}

/** Runs `count` ticks and returns the price after each one. */
function prices(engine: MarketEngine, count: number): number[] {
  return Array.from({ length: count }, () => priceOf(engine.tick()));
}

function seeds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `scenario-${String(index)}`);
}

describe("scenario definitions", () => {
  it("defines the five scenarios of the spec", () => {
    expect(Object.values(SimulationScenario)).toEqual([
      "STABLE_MARKET",
      "BULLISH_SESSION",
      "VOLATILE_SESSION",
      "SHARP_DRAWDOWN",
      "RECOVERY",
    ]);
    for (const id of Object.values(SimulationScenario)) {
      expect(scenarioDefinition(id).id).toBe(id);
      expect(scenarioDuration(scenarioDefinition(id))).toBeGreaterThan(0);
    }
  });

  it("walks the phases in order and ends after the last tick", () => {
    const drawdown = scenarioDefinition(SimulationScenario.SHARP_DRAWDOWN);
    expect(scenarioDuration(drawdown)).toBe(300);
    expect(scenarioProfileAt(drawdown, 0)).toEqual({ drift: -0.0007, volatility: 0.001 });
    expect(scenarioProfileAt(drawdown, 179)).toEqual({ drift: -0.0007, volatility: 0.001 });
    expect(scenarioProfileAt(drawdown, 180)).toEqual({ drift: 0, volatility: 0.0015 });
    expect(scenarioProfileAt(drawdown, 299)).toEqual({ drift: 0, volatility: 0.0015 });
    expect(scenarioProfileAt(drawdown, 300)).toBeNull();
  });
});

describe("market engine scenarios", () => {
  it("replays the same series for the same seed and scenario", () => {
    const run = (): number[] => {
      const engine = engineFor("replay");
      engine.startScenario(SimulationScenario.VOLATILE_SESSION);
      return prices(engine, 200);
    };
    expect(run()).toEqual(run());
  });

  it("STABLE_MARKET stays close to the start", () => {
    for (const seed of seeds(20)) {
      const engine = engineFor(seed);
      engine.startScenario(SimulationScenario.STABLE_MARKET);
      const series = prices(engine, 600);
      for (const price of series) {
        expect(Math.abs(price - START)).toBeLessThan(START * 0.03);
      }
    }
  });

  it("BULLISH_SESSION ends well above the start", () => {
    for (const seed of seeds(20)) {
      const engine = engineFor(seed);
      engine.startScenario(SimulationScenario.BULLISH_SESSION);
      const series = prices(engine, 600);
      expect(series[series.length - 1]).toBeGreaterThan(START * 1.05);
    }
  });

  it("VOLATILE_SESSION moves more than STABLE_MARKET", () => {
    const meanMove = (id: SimulationScenario): number => {
      const engine = engineFor("compare");
      engine.startScenario(id);
      const moves = Array.from({ length: 600 }, () => {
        const tick = engine.tick()[0];
        return tick ? Math.abs(tick.tickChange.toNumber()) : 0;
      });
      return moves.reduce((sum, move) => sum + move, 0) / moves.length;
    };
    expect(meanMove(SimulationScenario.VOLATILE_SESSION)).toBeGreaterThan(
      meanMove(SimulationScenario.STABLE_MARKET) * 3,
    );
  });

  it("SHARP_DRAWDOWN falls fast in its first phase", () => {
    for (const seed of seeds(20)) {
      const engine = engineFor(seed);
      engine.startScenario(SimulationScenario.SHARP_DRAWDOWN);
      const series = prices(engine, 180);
      expect(series[series.length - 1]).toBeLessThan(START * 0.95);
    }
  });

  it("RECOVERY climbs from the start to the end", () => {
    for (const seed of seeds(20)) {
      const engine = engineFor(seed);
      engine.startScenario(SimulationScenario.RECOVERY);
      const series = prices(engine, 600);
      expect(series[series.length - 1]).toBeGreaterThan(START * 1.05);
    }
  });

  it("never reaches zero, even in a drawdown from the minimum price", () => {
    const engine = engineFor("floor", undefined, "0.01");
    engine.startScenario(SimulationScenario.SHARP_DRAWDOWN);
    for (const price of prices(engine, 300)) {
      expect(price).toBeGreaterThan(0);
    }
  });

  it("reports its progress and ends after its last tick, handing back to the mode", () => {
    const engine = engineFor("progress", MarketMode.BEARISH);
    expect(engine.scenario()).toBeNull();
    engine.startScenario(SimulationScenario.SHARP_DRAWDOWN);
    expect(engine.scenario()).toEqual({
      id: "SHARP_DRAWDOWN",
      elapsedTicks: 0,
      totalTicks: 300,
    });
    prices(engine, 299);
    expect(engine.scenario()?.elapsedTicks).toBe(299);
    prices(engine, 1);
    expect(engine.scenario()).toBeNull();
    expect(engine.mode()).toBe(MarketMode.BEARISH);
    expect(engine.tick()).toHaveLength(1);
  });

  it("does not advance while PAUSED and resumes where it stopped", () => {
    const engine = engineFor("pause");
    engine.startScenario(SimulationScenario.RECOVERY);
    prices(engine, 10);
    engine.setMode(MarketMode.PAUSED);
    expect(engine.tick()).toEqual([]);
    expect(engine.scenario()?.elapsedTicks).toBe(10);
    engine.setMode(MarketMode.NORMAL);
    prices(engine, 1);
    expect(engine.scenario()?.elapsedTicks).toBe(11);
  });

  it("uses the scenario instead of the mode while it runs", () => {
    const withScenario = (mode: MarketMode): number[] => {
      const engine = engineFor("override", mode);
      engine.startScenario(SimulationScenario.BULLISH_SESSION);
      return prices(engine, 100);
    };
    expect(withScenario(MarketMode.BEARISH)).toEqual(withScenario(MarketMode.VOLATILE));
  });

  it("restarts from the first tick when a scenario replaces a running one, and stops on request", () => {
    const engine = engineFor("restart");
    engine.startScenario(SimulationScenario.RECOVERY);
    prices(engine, 50);
    engine.startScenario(SimulationScenario.STABLE_MARKET);
    expect(engine.scenario()).toEqual({ id: "STABLE_MARKET", elapsedTicks: 0, totalTicks: 600 });
    engine.stopScenario();
    expect(engine.scenario()).toBeNull();
  });
});
