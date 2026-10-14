import { describe, expect, it } from "vitest";
import type { Scenario } from "@trading/domain";
import {
  archiveScenarioResponseSchema,
  presentScenario,
  scenarioResponseSchema,
} from "./scenario.response.js";

const entity: Scenario = {
  id: "s1",
  portfolioId: "p1",
  name: "Crash",
  description: null,
  baseSnapshotId: null,
  status: "DRAFT",
  changes: [
    { assetId: "a1", percentChange: -12 },
    { assetId: "a2", percentChange: 5.5 },
  ],
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  updatedAt: new Date("2026-10-14T12:00:00.000Z"),
};

describe("scenario presenter", () => {
  it("serializes exactly what the API returned before", () => {
    const dto = presentScenario(entity);
    expect(dto).toEqual(JSON.parse(JSON.stringify(entity)));
    expect(scenarioResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes a scenario with no changes", () => {
    const dto = presentScenario({ ...entity, changes: [], description: "d" });
    expect(dto.changes).toEqual([]);
    expect(scenarioResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const withExtra = {
      ...entity,
      extra: 1,
      changes: [{ assetId: "a1", percentChange: 1, extra: 2 } as Scenario["changes"][number]],
    } as Scenario;
    const dto = presentScenario(withExtra);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "baseSnapshotId",
        "changes",
        "createdAt",
        "description",
        "id",
        "name",
        "portfolioId",
        "status",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(dto.changes[0] ?? {}).sort()).toEqual(["assetId", "percentChange"]);
  });

  it("describes the archive response with its alreadyArchived meta", () => {
    const body = { data: presentScenario(entity), meta: { alreadyArchived: false } };
    expect(archiveScenarioResponseSchema.safeParse(body).success).toBe(true);
    expect(archiveScenarioResponseSchema.safeParse({ data: body.data }).success).toBe(false);
  });
});
