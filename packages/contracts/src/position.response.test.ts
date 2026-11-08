import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import type { Position, PositionMetrics } from "@trading/domain";
import {
  positionDetailResponseSchema,
  positionResponseSchema,
  presentPosition,
  presentPositionDetail,
} from "./position.response.js";

const position: Position = {
  id: "pos1",
  portfolioId: "p1",
  assetId: "a1",
  quantity: 10,
  averageEntryPrice: Money.of("100", "USD"),
  currentPrice: Money.of("150.5", "USD"),
  openedAt: new Date("2026-10-01T12:00:00.000Z"),
  updatedAt: new Date("2026-10-13T12:00:00.000Z"),
};

const metrics: PositionMetrics = {
  marketValue: Money.of("1505", "USD"),
  costBasis: Money.of("1000", "USD"),
  unrealizedPnL: Money.of("505", "USD"),
  unrealizedPnLPercent: 50.5,
};

describe("position presenters", () => {
  it("serializes a position exactly as before", () => {
    const dto = presentPosition(position);
    expect(dto).toEqual(JSON.parse(JSON.stringify(position)));
    expect(dto.currentPrice).toEqual({ amount: "150.5", currency: "USD" });
    expect(positionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes the detail ({ position, metrics }) exactly as before", () => {
    const dto = presentPositionDetail({ position, metrics });
    expect(dto).toEqual(JSON.parse(JSON.stringify({ position, metrics })));
    expect(positionDetailResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    expect(Object.keys(presentPosition({ ...position, extra: 1 } as Position)).sort()).toEqual(
      [
        "assetId",
        "averageEntryPrice",
        "currentPrice",
        "id",
        "openedAt",
        "portfolioId",
        "quantity",
        "updatedAt",
      ].sort(),
    );
    expect(
      Object.keys(
        presentPositionDetail({ position, metrics: { ...metrics, extra: 1 } as PositionMetrics })
          .metrics,
      ).sort(),
    ).toEqual(["costBasis", "marketValue", "unrealizedPnL", "unrealizedPnLPercent"]);
  });
});
