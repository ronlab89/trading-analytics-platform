import type { Actor } from "./actor.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";

/** The lifecycle of the server simulator (ADR-007 point 16): there is no stop and no reset. */
export type SimulationState = "RUNNING" | "HALTED";

/** The market mode wire identifiers (ADR-007 point 15). */
export type SimulationMode = "PAUSED" | "NORMAL" | "VOLATILE" | "BULLISH" | "BEARISH";

export interface SimulationStatus {
  readonly state: SimulationState;
  readonly mode: SimulationMode;
}

/**
 * What the use cases need from the simulator, implemented by the adapter in
 * `apps/api` (ADR-007 point 17). Every call answers the status after it ran.
 * Repeating a call that changes nothing is not an error: it answers the same
 * status.
 */
export interface SimulationControl {
  /** `HALTED` to `RUNNING`, into the mode in effect when it was halted. */
  start: () => SimulationStatus;
  /** `RUNNING` to `HALTED`: nothing ticks and no candle closes until `start`. */
  pause: () => SimulationStatus;
  /** Takes effect on the next tick, or on `start` while `HALTED`. */
  setMode: (mode: SimulationMode) => SimulationStatus;
}

export interface SimulationServiceDependencies {
  control: SimulationControl;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Simulation control use cases.
 * Source: ADR-007 points 10, 15 and 16, 08-realtime-spec.md §40-§41.
 *
 * The simulator is global, not owned by a user, so only the
 * `simulation:control` permission applies (`ADMIN`, ADR-005) and there is no
 * ownership check. The permission is checked before the simulator is touched.
 */
export function createSimulationService(dependencies: SimulationServiceDependencies) {
  const { control, permissions = ROLE_PERMISSIONS } = dependencies;

  function startSimulation(actor: Actor): SimulationStatus {
    assertPermission(actor, "simulation:control", permissions);
    return control.start();
  }

  function pauseSimulation(actor: Actor): SimulationStatus {
    assertPermission(actor, "simulation:control", permissions);
    return control.pause();
  }

  function changeSimulationMode(actor: Actor, mode: SimulationMode): SimulationStatus {
    assertPermission(actor, "simulation:control", permissions);
    return control.setMode(mode);
  }

  return { startSimulation, pauseSimulation, changeSimulationMode };
}

export type SimulationService = ReturnType<typeof createSimulationService>;
