import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money";
import type { Position } from "../entities/position";
import { calculateAllocation } from "./allocation";

function buildPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: "position_001",
    portfolioId: "portfolio_001",
    assetId: "asset_001",
    quantity: 10,
    averageEntryPrice: Money.of(100, "USD"),
    currentPrice: Money.of(120, "USD"),
    openedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("calculateAllocation", () => {
  it("should return an empty array for an empty position list", () => {
    const groups = calculateAllocation([], (position) => position.assetId);

    expect(groups).toEqual([]);
  });

  it("should return a single group at 100% for one position", () => {
    const position = buildPosition();

    const groups = calculateAllocation([position], (p) => p.assetId);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("asset_001");
    expect(groups[0]?.marketValue.equals(Money.of(1200, "USD"))).toBe(true);
    expect(groups[0]?.percentage).toBeCloseTo(100, 5);
  });

  it("should split allocation proportionally across two assets", () => {
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        quantity: 10,
        currentPrice: Money.of(120, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 5,
        currentPrice: Money.of(120, "USD"),
      }),
    ];

    const groups = calculateAllocation(positions, (p) => p.assetId);

    // asset_001 = 1200, asset_002 = 600, total = 1800
    const assetOne = groups.find((g) => g.key === "asset_001");
    const assetTwo = groups.find((g) => g.key === "asset_002");

    expect(assetOne?.percentage).toBeCloseTo((1200 / 1800) * 100, 5);
    expect(assetTwo?.percentage).toBeCloseTo((600 / 1800) * 100, 5);
  });

  it("should merge multiple positions into the same group when groupBy returns the same key", () => {
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
    ];

    // Group everything under a single synthetic key, e.g. simulating
    // grouping by a shared asset type resolved by the caller.
    const groups = calculateAllocation(positions, () => "CRYPTO");

    expect(groups).toHaveLength(1);
    expect(groups[0]?.marketValue.equals(Money.of(2000, "USD"))).toBe(true);
    expect(groups[0]?.percentage).toBeCloseTo(100, 5);
  });

  it("should group by currency when groupBy resolves the position's currency", () => {
    const positions = [
      buildPosition({
        id: "position_001",
        assetId: "asset_001",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        quantity: 10,
        currentPrice: Money.of(100, "USD"),
      }),
    ];

    const groups = calculateAllocation(positions, (p) => p.currentPrice.currency);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("USD");
  });

  it("should not force percentages to rebalance to exactly 100", () => {
    // Three equal groups produce a repeating percentage (33.333...%)
    // that does not sum to exactly 100 due to floating point — this is
    // expected and must not be silently corrected.
    const positions = [
      buildPosition({ id: "position_001", assetId: "a", quantity: 1 }),
      buildPosition({ id: "position_002", assetId: "b", quantity: 1 }),
      buildPosition({ id: "position_003", assetId: "c", quantity: 1 }),
    ];

    const groups = calculateAllocation(positions, (p) => p.assetId);

    for (const group of groups) {
      expect(group.percentage).toBeCloseTo(33.333, 2);
    }
  });

  it("should throw CurrencyMismatchError when positions have different currencies", () => {
    const positions = [
      buildPosition({ id: "position_001", currentPrice: Money.of(100, "USD") }),
      buildPosition({
        id: "position_002",
        assetId: "asset_002",
        currentPrice: Money.of(100, "EUR"),
      }),
    ];

    expect(() => {
      calculateAllocation(positions, (p) => p.assetId);
    }).toThrow();
  });
});
