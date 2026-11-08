import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYTICS_PERIOD,
  periodKey,
  toPeriodQuery,
  type AnalyticsPeriod,
} from "./analytics-period";

const custom: AnalyticsPeriod = { kind: "custom", from: "2026-10-01", to: "2026-10-14" };

describe("analytics period", () => {
  it("opens on the month, as the API and the Figma do", () => {
    expect(DEFAULT_ANALYTICS_PERIOD).toEqual({ kind: "preset", period: "1M" });
  });

  it("asks the API for a preset with `period` alone", () => {
    expect(toPeriodQuery({ kind: "preset", period: "3M" })).toEqual({ period: "3M" });
  });

  it("asks the API for a custom range with `from` and `to` and no `period`", () => {
    expect(toPeriodQuery(custom)).toEqual({ from: "2026-10-01", to: "2026-10-14" });
  });

  it("gives each period its own key, so the answers are cached apart", () => {
    expect(periodKey({ kind: "preset", period: "1M" })).toBe("1M");
    expect(periodKey(custom)).toBe("2026-10-01..2026-10-14");
    expect(periodKey(custom)).not.toBe(periodKey({ ...custom, to: "2026-10-15" }));
  });
});
