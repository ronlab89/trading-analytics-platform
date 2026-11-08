import { describe, expect, it } from "vitest";
import { Decimal } from "@trading/domain";
import type { ReturnDrawdown, ReturnVolatility } from "@trading/domain";
import { presentRisk, riskResponseSchema } from "./risk.response.js";

const knownVolatility: ReturnVolatility = {
  status: "OK",
  volatilityPercent: new Decimal("19.601"),
  sampleSize: 20,
};

const unknownVolatility: ReturnVolatility = {
  status: "UNKNOWN",
  volatilityPercent: null,
  sampleSize: 5,
};

const knownDrawdown: ReturnDrawdown = {
  status: "OK",
  maxDrawdown: new Decimal("-0.2"),
  currentDrawdown: new Decimal("-0.16"),
  peakDate: new Date(Date.UTC(2026, 0, 2, 13, 30)),
  troughDate: new Date(Date.UTC(2026, 0, 3)),
};

const unknownDrawdown: ReturnDrawdown = {
  status: "UNKNOWN",
  maxDrawdown: null,
  currentDrawdown: null,
  peakDate: null,
  troughDate: null,
};

const asOf = new Date(Date.UTC(2026, 0, 31));
const effectiveFrom = new Date(Date.UTC(2026, 0, 1));

describe("presentRisk", () => {
  it("presents drawdowns as percentage points and dates as UTC calendar dates", () => {
    const risk = presentRisk({
      asOf,
      effectiveFrom,
      status: "OK",
      volatility: knownVolatility,
      drawdown: knownDrawdown,
    });

    expect(riskResponseSchema.parse(risk)).toEqual({
      asOf: "2026-01-31",
      effectiveFrom: "2026-01-01",
      status: "OK",
      volatilityPercent: 19.601,
      maxDrawdownPercent: -20,
      currentDrawdownPercent: -16,
      peakDate: "2026-01-02",
      troughDate: "2026-01-03",
    });
  });

  it("keeps a known drawdown when the volatility is null", () => {
    const risk = presentRisk({
      asOf,
      effectiveFrom,
      status: "OK",
      volatility: unknownVolatility,
      drawdown: knownDrawdown,
    });

    expect(risk.volatilityPercent).toBeNull();
    expect(risk.maxDrawdownPercent).toBe(-20);
  });

  it("presents unavailable values as null, never 0", () => {
    const risk = presentRisk({
      asOf,
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      volatility: unknownVolatility,
      drawdown: unknownDrawdown,
    });

    expect(riskResponseSchema.parse(risk)).toEqual({
      asOf: "2026-01-31",
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      volatilityPercent: null,
      maxDrawdownPercent: null,
      currentDrawdownPercent: null,
      peakDate: null,
      troughDate: null,
    });
  });

  it("presents a drawdown of zero as 0 with no dates", () => {
    const risk = presentRisk({
      asOf,
      effectiveFrom,
      status: "OK",
      volatility: unknownVolatility,
      drawdown: {
        status: "OK",
        maxDrawdown: new Decimal(0),
        currentDrawdown: new Decimal(0),
        peakDate: null,
        troughDate: null,
      },
    });

    expect(risk.maxDrawdownPercent).toBe(0);
    expect(risk.peakDate).toBeNull();
  });
});
