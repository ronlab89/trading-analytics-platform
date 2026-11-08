import { describe, expect, it } from "vitest";
import type { AlertRow } from "./alert-row";
import {
  alertFormFromRow,
  alertFormSchema,
  emptyAlertForm,
  toCreateAlertBody,
  toUpdateAlertBody,
} from "./alert-form";

const row: AlertRow = {
  id: "al1",
  assetId: "a1",
  symbol: "AAPL",
  name: "Apple Inc.",
  currency: "USD",
  condition: "ABOVE",
  threshold: 200,
  enabled: true,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

const valid = { assetId: "a1", condition: "ABOVE", threshold: "200", enabled: true } as const;

describe("alertFormSchema", () => {
  it("accepts an asset, a condition and a positive threshold", () => {
    expect(alertFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an asset", () => {
    expect(alertFormSchema.safeParse({ ...valid, assetId: "" }).success).toBe(false);
  });

  it.each(["", "0", "0.00", "-5", "abc", "1,5", "1e3"])("refuses the threshold %j", (threshold) => {
    expect(alertFormSchema.safeParse({ ...valid, threshold }).success).toBe(false);
  });

  it.each(["0.5", "150", " 150.25 "])("accepts the threshold %j", (threshold) => {
    expect(alertFormSchema.safeParse({ ...valid, threshold }).success).toBe(true);
  });

  it("offers only the conditions the API evaluates", () => {
    expect(alertFormSchema.safeParse({ ...valid, condition: "CROSSES" }).success).toBe(false);
  });
});

describe("emptyAlertForm", () => {
  it("starts enabled, above, with no threshold", () => {
    expect(emptyAlertForm()).toEqual({
      assetId: "",
      condition: "ABOVE",
      threshold: "",
      enabled: true,
    });
  });

  it("starts with the asset it is given", () => {
    expect(emptyAlertForm("a9").assetId).toBe("a9");
  });
});

describe("alertFormFromRow", () => {
  it("fills the form with the alert", () => {
    expect(alertFormFromRow({ ...row, condition: "BELOW", threshold: 55, enabled: false })).toEqual(
      {
        assetId: "a1",
        condition: "BELOW",
        threshold: "55.00",
        enabled: false,
      },
    );
  });
});

describe("toCreateAlertBody", () => {
  it("builds a price alert on the asset, with the threshold as a number", () => {
    expect(toCreateAlertBody(alertFormSchema.parse({ ...valid, threshold: " 150.5 " }))).toEqual({
      assetId: "a1",
      type: "PRICE",
      condition: "ABOVE",
      threshold: 150.5,
      enabled: true,
    });
  });

  it("sends an alert that starts paused as paused", () => {
    expect(toCreateAlertBody(alertFormSchema.parse({ ...valid, enabled: false })).enabled).toBe(
      false,
    );
  });
});

describe("toUpdateAlertBody", () => {
  it("is null when nothing changed", () => {
    expect(
      toUpdateAlertBody(alertFormSchema.parse({ ...valid, threshold: "200.00" }), row),
    ).toBeNull();
  });

  it("sends only the condition when only it changed", () => {
    expect(toUpdateAlertBody(alertFormSchema.parse({ ...valid, condition: "BELOW" }), row)).toEqual(
      {
        condition: "BELOW",
      },
    );
  });

  it("sends only the threshold when only it changed", () => {
    expect(toUpdateAlertBody(alertFormSchema.parse({ ...valid, threshold: "250" }), row)).toEqual({
      threshold: 250,
    });
  });

  it("sends only enabled when only it changed", () => {
    expect(toUpdateAlertBody(alertFormSchema.parse({ ...valid, enabled: false }), row)).toEqual({
      enabled: false,
    });
  });

  it("sends every field that changed", () => {
    expect(
      toUpdateAlertBody(
        alertFormSchema.parse({ ...valid, condition: "BELOW", threshold: "180", enabled: false }),
        row,
      ),
    ).toEqual({ condition: "BELOW", threshold: 180, enabled: false });
  });
});
