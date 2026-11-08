import { describe, expect, it } from "vitest";
import { attributionQuerySchema } from "./analytics.schema.js";

function parse(query: Record<string, string>) {
  return attributionQuerySchema.safeParse(query);
}

describe("attributionQuerySchema", () => {
  it("asks for the current-state attribution when nothing is sent", () => {
    expect(parse({})).toEqual({ success: true, data: { kind: "current" } });
  });

  it("asks for the range attribution of 1M when only `groupBy` is sent", () => {
    expect(parse({ groupBy: "asset" })).toMatchObject({
      success: true,
      data: { kind: "range", groupBy: "asset", period: { kind: "preset", period: "1M" } },
    });
  });

  it("reads a preset period and groups by asset by default", () => {
    expect(parse({ period: "3M" })).toMatchObject({
      success: true,
      data: { kind: "range", groupBy: "asset", period: { kind: "preset", period: "3M" } },
    });
  });

  it("reads a custom range as UTC dates", () => {
    expect(parse({ from: "2026-03-10", to: "2026-03-12", groupBy: "assetType" })).toMatchObject({
      success: true,
      data: {
        kind: "range",
        groupBy: "assetType",
        period: {
          kind: "custom",
          from: new Date(Date.UTC(2026, 2, 10)),
          to: new Date(Date.UTC(2026, 2, 12)),
        },
      },
    });
  });

  it("rejects a `groupBy` the attribution does not support", () => {
    expect(parse({ groupBy: "currency" }).success).toBe(false);
    expect(parse({ groupBy: "sector" }).success).toBe(false);
  });

  it("rejects `1D`, `to` without `from`, `from` after `to` and `period` with a range", () => {
    expect(parse({ period: "1D" }).success).toBe(false);
    expect(parse({ to: "2026-03-12" }).success).toBe(false);
    expect(parse({ from: "2026-03-12", to: "2026-03-10" }).success).toBe(false);
    expect(parse({ period: "1M", from: "2026-03-10" }).success).toBe(false);
  });
});
