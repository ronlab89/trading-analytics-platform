import { describe, expect, it, vi } from "vitest";
import type { Actor } from "./actor.js";
import { ForbiddenError } from "./errors.js";
import { PERMISSIONS } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import { createSimulationService } from "./simulation-service.js";
import type { SimulationControl, SimulationStatus } from "./simulation-service.js";

const admin: Actor = { userId: "u-admin", role: "ADMIN" };
const trader: Actor = { userId: "u-trader", role: "TRADER" };
const viewer: Actor = { userId: "u-viewer", role: "VIEWER" };

const running: SimulationStatus = { state: "RUNNING", mode: "NORMAL" };
const halted: SimulationStatus = { state: "HALTED", mode: "NORMAL" };

function build(permissions?: RolePermissions) {
  const control = {
    start: vi.fn<SimulationControl["start"]>(() => running),
    pause: vi.fn<SimulationControl["pause"]>(() => halted),
    setMode: vi.fn<SimulationControl["setMode"]>((mode) => ({ state: "RUNNING", mode })),
  };
  const service = createSimulationService({ control, ...(permissions ? { permissions } : {}) });
  return { control, service };
}

describe("simulation service", () => {
  it("lets an ADMIN start, pause and change the mode, answering the status of the simulator", () => {
    const { control, service } = build();

    expect(service.startSimulation(admin)).toEqual(running);
    expect(service.pauseSimulation(admin)).toEqual(halted);
    expect(service.changeSimulationMode(admin, "VOLATILE")).toEqual({
      state: "RUNNING",
      mode: "VOLATILE",
    });
    expect(control.start).toHaveBeenCalledTimes(1);
    expect(control.pause).toHaveBeenCalledTimes(1);
    expect(control.setMode).toHaveBeenCalledWith("VOLATILE");
  });

  it.each([
    ["TRADER", trader],
    ["VIEWER", viewer],
  ])(
    "refuses a %s with Forbidden, naming the permission, and leaves the simulator alone",
    (_, actor) => {
      const { control, service } = build();
      const calls = [
        () => service.startSimulation(actor),
        () => service.pauseSimulation(actor),
        () => service.changeSimulationMode(actor, "BEARISH"),
      ];

      for (const call of calls) {
        expect(call).toThrow(ForbiddenError);
        expect(call).toThrow("simulation:control");
      }
      expect(control.start).not.toHaveBeenCalled();
      expect(control.pause).not.toHaveBeenCalled();
      expect(control.setMode).not.toHaveBeenCalled();
    },
  );

  it("checks the injected matrix, not the role name", () => {
    const withoutControl: RolePermissions = {
      VIEWER: new Set(),
      TRADER: new Set(),
      ADMIN: new Set(PERMISSIONS.filter((permission) => permission !== "simulation:control")),
    };
    const { control, service } = build(withoutControl);

    expect(() => service.startSimulation(admin)).toThrow(ForbiddenError);
    expect(control.start).not.toHaveBeenCalled();
  });
});
