import { describe, expect, it } from "vitest";
import {
  SIMULATION_MODES,
  presentSimulationStatus,
  simulationModeRequestSchema,
  simulationStatusResponseSchema,
} from "./simulation.schema.js";

describe("simulationModeRequestSchema", () => {
  it.each(["PAUSED", "NORMAL", "VOLATILE", "BULLISH", "BEARISH"])("accepts the mode %s", (mode) => {
    expect(simulationModeRequestSchema.safeParse({ mode }).data).toEqual({ mode });
  });

  it("lists exactly the five wire identifiers of ADR-007 point 15", () => {
    expect([...SIMULATION_MODES]).toEqual(["PAUSED", "NORMAL", "VOLATILE", "BULLISH", "BEARISH"]);
  });

  it.each(["normal", "HALTED", "RUNNING", "", " NORMAL"])(
    "rejects the mode %j with an issue on mode",
    (mode) => {
      const result = simulationModeRequestSchema.safeParse({ mode });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["mode"]);
      expect(result.error?.issues[0]?.message).toBe(
        "Mode must be one of: PAUSED, NORMAL, VOLATILE, BULLISH, BEARISH.",
      );
    },
  );

  it.each([{}, { mode: 1 }, { mode: null }])("rejects the body %j", (body) => {
    expect(simulationModeRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("presentSimulationStatus", () => {
  it("answers the state and the mode, as the response schema describes them", () => {
    const presented = presentSimulationStatus({ state: "HALTED", mode: "BULLISH" });

    expect(presented).toEqual({ state: "HALTED", mode: "BULLISH" });
    expect(simulationStatusResponseSchema.safeParse(presented).success).toBe(true);
  });

  it("only knows the lifecycle states RUNNING and HALTED", () => {
    expect(
      simulationStatusResponseSchema.safeParse({ state: "PAUSED", mode: "NORMAL" }).success,
    ).toBe(false);
  });
});
