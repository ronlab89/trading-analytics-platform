import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import {
  presentRangeAttribution,
  rangeAttributionResponseSchema,
} from "./range-attribution.response.js";

const day = (n: number) => new Date(Date.UTC(2026, 2, n));

describe("presentRangeAttribution", () => {
  it("serializes the dates, the group labels and the contributions in money", () => {
    const dto = presentRangeAttribution({
      asOf: day(3),
      effectiveFrom: day(1),
      status: "OK",
      groupBy: "assetType",
      pnl: Money.of("11", "USD"),
      groups: [
        { key: "CRYPTO", label: "CRYPTO", contribution: Money.of("-5", "USD") },
        { key: "STOCK", label: "STOCK", contribution: Money.of("16", "USD") },
      ],
    });

    expect(dto).toEqual({
      asOf: "2026-03-03",
      effectiveFrom: "2026-03-01",
      status: "OK",
      groupBy: "assetType",
      pnl: { amount: "11", currency: "USD" },
      groups: [
        { key: "CRYPTO", label: "CRYPTO", contribution: { amount: "-5", currency: "USD" } },
        { key: "STOCK", label: "STOCK", contribution: { amount: "16", currency: "USD" } },
      ],
    });
    expect(rangeAttributionResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("keeps an unavailable period as nulls, never as zero", () => {
    const dto = presentRangeAttribution({
      asOf: day(3),
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      groupBy: "asset",
      pnl: null,
      groups: [],
    });

    expect(dto).toMatchObject({ effectiveFrom: null, pnl: null, groups: [] });
    expect(rangeAttributionResponseSchema.safeParse(dto).success).toBe(true);
  });
});
