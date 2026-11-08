import type { PriceProfile } from "./mode.js";

/**
 * Deterministic scenarios.
 * Source: 12-demo-mode-spec.md §39, 08-realtime-spec.md §37 (wire identifiers, ADR-007 point 15).
 */
export const SimulationScenario = {
  STABLE_MARKET: "STABLE_MARKET",
  BULLISH_SESSION: "BULLISH_SESSION",
  VOLATILE_SESSION: "VOLATILE_SESSION",
  SHARP_DRAWDOWN: "SHARP_DRAWDOWN",
  RECOVERY: "RECOVERY",
} as const;

export type SimulationScenario = (typeof SimulationScenario)[keyof typeof SimulationScenario];

/** A stretch of a scenario: `ticks` ticks (1 second each, 08-realtime-spec.md §38) with one profile. */
export interface ScenarioPhase {
  readonly ticks: number;
  readonly profile: PriceProfile;
}

/**
 * A scenario starts from the prices the engine holds when it starts, runs its phases in order
 * (the event sequence and timing) and then ends, handing the engine back to its mode. The
 * expected behavior is what the phase profiles produce on average: the same seed gives the same
 * series, and the direction of each phase is much larger than its noise.
 */
export interface ScenarioDefinition {
  readonly id: SimulationScenario;
  readonly phases: readonly ScenarioPhase[];
}

const SCENARIOS: Readonly<Record<SimulationScenario, ScenarioDefinition>> = {
  // 10 minutes of quiet trading: about +-0.5% around the start.
  STABLE_MARKET: {
    id: "STABLE_MARKET",
    phases: [{ ticks: 600, profile: { drift: 0, volatility: 0.0002 } }],
  },
  // 10 minutes of steady gains: about +12%.
  BULLISH_SESSION: {
    id: "BULLISH_SESSION",
    phases: [{ ticks: 600, profile: { drift: 0.0002, volatility: 0.0005 } }],
  },
  // 10 minutes of wide swings with no direction: about +-5%.
  VOLATILE_SESSION: {
    id: "VOLATILE_SESSION",
    phases: [{ ticks: 600, profile: { drift: 0, volatility: 0.002 } }],
  },
  // 3 minutes of heavy selling (about -12%), then 2 minutes of choppy sideways trading.
  SHARP_DRAWDOWN: {
    id: "SHARP_DRAWDOWN",
    phases: [
      { ticks: 180, profile: { drift: -0.0007, volatility: 0.001 } },
      { ticks: 120, profile: { drift: 0, volatility: 0.0015 } },
    ],
  },
  // 5 minutes of a strong rebound (about +9%), then 5 minutes of a slower climb (about +3%).
  RECOVERY: {
    id: "RECOVERY",
    phases: [
      { ticks: 300, profile: { drift: 0.0003, volatility: 0.001 } },
      { ticks: 300, profile: { drift: 0.0001, volatility: 0.0004 } },
    ],
  },
};

export function scenarioDefinition(id: SimulationScenario): ScenarioDefinition {
  return SCENARIOS[id];
}

export function scenarioDuration(definition: ScenarioDefinition): number {
  return definition.phases.reduce((total, phase) => total + phase.ticks, 0);
}

/** The profile of the scenario's tick number `tickIndex` (from 0), or `null` once it has ended. */
export function scenarioProfileAt(
  definition: ScenarioDefinition,
  tickIndex: number,
): PriceProfile | null {
  let remaining = tickIndex;
  for (const phase of definition.phases) {
    if (remaining < phase.ticks) {
      return phase.profile;
    }
    remaining -= phase.ticks;
  }
  return null;
}
