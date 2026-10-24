import { describe, expect, it } from "vitest";
import type { Alert } from "@trading/domain";
import { alertResponseSchema, presentAlert } from "./alert.response.js";

const entity: Alert = {
  id: "al1",
  userId: "u1",
  assetId: "a1",
  portfolioId: null,
  type: "PRICE",
  condition: "ABOVE",
  threshold: 100.5,
  enabled: true,
  armed: false,
  lastTriggeredAt: new Date("2026-10-14T11:00:00.000Z"),
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
  updatedAt: new Date("2026-10-14T12:00:00.000Z"),
};

describe("alert presenter", () => {
  it("serializes exactly what the API returned before", () => {
    const dto = presentAlert(entity);
    const { armed: _armed, lastTriggeredAt: _lastTriggeredAt, ...stored } = entity;
    expect(dto).toEqual(JSON.parse(JSON.stringify(stored)));
    expect(alertResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("keeps the edge-trigger state out of the response", () => {
    const dto = presentAlert(entity);
    expect(dto).not.toHaveProperty("armed");
    expect(dto).not.toHaveProperty("lastTriggeredAt");
  });

  it("does not leak fields outside the contract", () => {
    const dto = presentAlert({ ...entity, extra: 1 } as Alert);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "assetId",
        "condition",
        "createdAt",
        "enabled",
        "id",
        "portfolioId",
        "threshold",
        "type",
        "updatedAt",
        "userId",
      ].sort(),
    );
  });
});
