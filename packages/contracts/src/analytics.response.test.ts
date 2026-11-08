import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import {
  allocationResponseSchema,
  attributionResponseSchema,
  presentAllocation,
  presentAttribution,
} from "./analytics.response.js";

const allocation = {
  groupBy: "asset" as const,
  groups: [
    { key: "a1", label: "BTC", marketValue: Money.of("1500.5", "USD"), percentage: 60 },
    { key: "a2", label: "ETH", marketValue: Money.of("1000", "USD"), percentage: 40 },
  ],
};

const attribution = {
  totalUnrealizedPnL: Money.of("250", "USD"),
  items: [
    {
      assetId: "a1",
      contribution: Money.of("500", "USD"),
      percentageOfTotal: 200,
      symbol: "BTC",
      name: "Bitcoin",
    },
    {
      assetId: "a2",
      contribution: Money.of("-250", "USD"),
      percentageOfTotal: -100,
      symbol: "ETH",
      name: "",
    },
  ],
};

describe("analytics presenters", () => {
  it("serializes allocation exactly as before", () => {
    const dto = presentAllocation(allocation);
    expect(dto).toEqual(JSON.parse(JSON.stringify(allocation)));
    expect(dto.groups[0]?.marketValue).toEqual({ amount: "1500.5", currency: "USD" });
    expect(allocationResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("serializes an empty allocation", () => {
    const empty = { groupBy: "currency" as const, groups: [] };
    expect(presentAllocation(empty)).toEqual(JSON.parse(JSON.stringify(empty)));
  });

  it("serializes attribution exactly as before, negative amounts included", () => {
    const dto = presentAttribution(attribution);
    expect(dto).toEqual(JSON.parse(JSON.stringify(attribution)));
    expect(attributionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const item = { ...attribution.items[0], extra: 1 } as (typeof attribution.items)[number];
    const dto = presentAttribution({ ...attribution, items: [item] });
    expect(Object.keys(dto.items[0] ?? {}).sort()).toEqual(
      ["assetId", "contribution", "name", "percentageOfTotal", "symbol"].sort(),
    );
  });
});
