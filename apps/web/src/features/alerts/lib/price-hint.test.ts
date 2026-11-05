import { describe, expect, it } from "vitest";
import { priceHint } from "./price-hint";

describe("priceHint", () => {
  it("is armed for an above level the price has not reached", () => {
    expect(priceHint("ABOVE", 200, 180.7)).toEqual({ kind: "armed", direction: "ABOVE" });
  });

  it("is already met for an above level the price is over", () => {
    expect(priceHint("ABOVE", 150, 180.7)).toEqual({ kind: "already", direction: "ABOVE" });
  });

  it("is armed for a below level the price has not reached", () => {
    expect(priceHint("BELOW", 150, 180.7)).toEqual({ kind: "armed", direction: "BELOW" });
  });

  it("is already met for a below level the price is under", () => {
    expect(priceHint("BELOW", 200, 180.7)).toEqual({ kind: "already", direction: "BELOW" });
  });

  it("is armed when the price is exactly the threshold, as equal is not a crossing", () => {
    expect(priceHint("ABOVE", 180.7, 180.7).kind).toBe("armed");
    expect(priceHint("BELOW", 180.7, 180.7).kind).toBe("armed");
  });
});
