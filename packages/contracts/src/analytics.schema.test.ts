import { describe, expect, it } from "vitest";
import { analyticsPeriodQuerySchema } from "./analytics.schema.js";

function parse(query: Record<string, string>) {
  return analyticsPeriodQuerySchema.safeParse(query);
}

describe("analyticsPeriodQuerySchema", () => {
  it("defaults to the 1M preset", () => {
    expect(parse({})).toMatchObject({ success: true, data: { kind: "preset", period: "1M" } });
  });

  it.each(["1W", "1M", "3M", "6M", "1Y", "YTD", "ALL"])("accepts the %s preset", (period) => {
    expect(parse({ period })).toMatchObject({ success: true, data: { kind: "preset", period } });
  });

  it("rejects 1D, which comes from MarketPrice", () => {
    expect(parse({ period: "1D" }).success).toBe(false);
  });

  it("parses a custom range as UTC dates", () => {
    const result = parse({ from: "2026-03-10", to: "2026-03-12" });

    expect(result).toMatchObject({
      success: true,
      data: {
        kind: "custom",
        from: new Date(Date.UTC(2026, 2, 10)),
        to: new Date(Date.UTC(2026, 2, 12)),
      },
    });
  });

  it("leaves `to` out of a custom range when it is omitted", () => {
    const result = parse({ from: "2026-03-10" });

    expect(result).toMatchObject({ success: true, data: { kind: "custom" } });
    expect(result.data).not.toHaveProperty("to");
  });

  it("accepts a single-day range", () => {
    expect(parse({ from: "2026-03-10", to: "2026-03-10" }).success).toBe(true);
  });

  it("rejects from after to", () => {
    expect(parse({ from: "2026-03-10", to: "2026-03-09" }).success).toBe(false);
  });

  it("rejects period together with from or to", () => {
    expect(parse({ period: "1M", from: "2026-03-10" }).success).toBe(false);
    expect(parse({ period: "1M", to: "2026-03-10" }).success).toBe(false);
  });

  it("rejects to without from", () => {
    expect(parse({ to: "2026-03-10" }).success).toBe(false);
  });

  it("rejects dates that are not UTC calendar dates", () => {
    expect(parse({ from: "2026-03-10T10:00:00Z" }).success).toBe(false);
    expect(parse({ from: "2026-02-30" }).success).toBe(false);
    expect(parse({ from: "10/03/2026" }).success).toBe(false);
  });
});
