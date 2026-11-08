import type {
  SimulationControl,
  SimulationMode,
  SimulationState,
  SimulationStatus,
} from "@trading/application";

export interface DemoSimulationControl extends SimulationControl {
  status: () => SimulationStatus;
}

/**
 * The state of the market simulation (ADR-012 point 7), starting running in the normal mode like the
 * API simulator. It only keeps the state and answers the control operations; the ticks that follow
 * it are the in-process realtime of FE4.3, which reads this control.
 */
export function createDemoSimulationControl(): DemoSimulationControl {
  let state: SimulationState = "RUNNING";
  let mode: SimulationMode = "NORMAL";

  const status = (): SimulationStatus => ({ state, mode });

  return {
    status,
    start: () => {
      state = "RUNNING";
      return status();
    },
    pause: () => {
      state = "HALTED";
      return status();
    },
    setMode: (next) => {
      mode = next;
      return status();
    },
  };
}
