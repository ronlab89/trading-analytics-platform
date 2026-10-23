import { z } from "zod";

/**
 * Request and response contracts of the simulation controls.
 * Source: ADR-007 points 10, 15 and 16, 07-api-spec.md §54, 08-realtime-spec.md §37 and §40.
 *
 * Modes use the SCREAMING_SNAKE_CASE wire identifiers of ADR-007 point 15. The
 * lifecycle is only `RUNNING <-> HALTED` (point 16); `PAUSED` is a mode, not a
 * lifecycle state.
 */
export const SIMULATION_MODES = ["PAUSED", "NORMAL", "VOLATILE", "BULLISH", "BEARISH"] as const;
export const SIMULATION_STATES = ["RUNNING", "HALTED"] as const;

/** Body of `PUT /api/v1/simulation/mode`. */
export const simulationModeRequestSchema = z.object({
  mode: z.enum(SIMULATION_MODES, {
    error: "Mode must be one of: PAUSED, NORMAL, VOLATILE, BULLISH, BEARISH.",
  }),
});

export type SimulationModeRequestBody = z.infer<typeof simulationModeRequestSchema>;

/** What the three control endpoints answer inside `data`. */
export const simulationStatusResponseSchema = z.object({
  state: z.enum(SIMULATION_STATES),
  mode: z.enum(SIMULATION_MODES),
});

export type SimulationStatusResponse = z.infer<typeof simulationStatusResponseSchema>;

export function presentSimulationStatus(
  status: SimulationStatusResponse,
): SimulationStatusResponse {
  return { state: status.state, mode: status.mode };
}
