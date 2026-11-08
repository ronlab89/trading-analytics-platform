import type { MarketSimulator } from "../simulation/market-simulator.js";
import type { ShutdownStep } from "./shutdown.js";

/**
 * The shutdown step of the market simulator (ADR-006 point 12).
 *
 * Register it before the HTTP and database steps: the simulator stops ticking
 * and waits for the tick in flight, so no write is cut off by the closing
 * database client.
 */
export function createSimulatorShutdownStep(
  simulator: Pick<MarketSimulator, "stop">,
): ShutdownStep {
  return { name: "simulator", run: () => simulator.stop() };
}
