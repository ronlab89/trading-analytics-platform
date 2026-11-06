import type { ApiOperation } from "@trading/contracts";

export interface LatencyRange {
  readonly min: number;
  readonly max: number;
}

/** ADR-012 point 5: reads are quick, writes feel heavy, the way a real backend behaves. */
export const READ_LATENCY: LatencyRange = { min: 150, max: 400 };
export const WRITE_LATENCY: LatencyRange = { min: 400, max: 900 };

export interface Latency {
  /** Waits the simulated time of a call of this kind. */
  wait(method: ApiOperation["method"]): Promise<void>;
}

export interface LatencyOptions {
  /** A number in [0, 1); injected so tests are deterministic. */
  readonly random?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export const NO_LATENCY: Latency = { wait: () => Promise.resolve() };

export function latencyFor(method: ApiOperation["method"], random: () => number): number {
  const range = method === "get" ? READ_LATENCY : WRITE_LATENCY;
  return Math.round(range.min + random() * (range.max - range.min));
}

export function createLatency(options: LatencyOptions = {}): Latency {
  const {
    random = Math.random,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = options;
  return { wait: (method) => sleep(latencyFor(method, random)) };
}
