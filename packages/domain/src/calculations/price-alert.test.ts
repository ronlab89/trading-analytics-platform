import { describe, expect, it } from "vitest";
import { AlertType } from "../entities/enums.js";
import { Money } from "../value-objects/money.js";
import {
  initialAlertArmed,
  isPriceConditionCleared,
  isPriceConditionMet,
  nextPriceAlertAction,
  priceAlertDirection,
} from "./price-alert.js";

const usd = (amount: number) => Money.of(String(amount), "USD");

describe("priceAlertDirection", () => {
  const priceAlert = { type: AlertType.PRICE, assetId: "asset_001", condition: "ABOVE" };

  it("should read ABOVE and BELOW on a price alert with an asset", () => {
    expect(priceAlertDirection(priceAlert)).toBe("ABOVE");
    expect(priceAlertDirection({ ...priceAlert, condition: "BELOW" })).toBe("BELOW");
  });

  it("should ignore other types, a missing asset and other conditions", () => {
    expect(priceAlertDirection({ ...priceAlert, type: AlertType.VOLATILITY })).toBeNull();
    expect(priceAlertDirection({ ...priceAlert, assetId: null })).toBeNull();
    expect(priceAlertDirection({ ...priceAlert, condition: "above" })).toBeNull();
    expect(priceAlertDirection({ ...priceAlert, condition: "CROSSES" })).toBeNull();
  });
});

describe("isPriceConditionMet", () => {
  it("should be strict at the threshold", () => {
    expect(isPriceConditionMet("ABOVE", 100, usd(100))).toBe(false);
    expect(isPriceConditionMet("ABOVE", 100, usd(100.01))).toBe(true);
    expect(isPriceConditionMet("BELOW", 100, usd(100))).toBe(false);
    expect(isPriceConditionMet("BELOW", 100, usd(99.99))).toBe(true);
  });
});

describe("isPriceConditionCleared", () => {
  it("should clear an ABOVE alert at threshold * (1 - band) or lower", () => {
    const edge = 99.5;
    expect(isPriceConditionCleared("ABOVE", 100, usd(edge))).toBe(true);
    expect(isPriceConditionCleared("ABOVE", 100, usd(edge + 0.01))).toBe(false);
  });

  it("should clear a BELOW alert at threshold * (1 + band) or higher", () => {
    const edge = 100.5;
    expect(isPriceConditionCleared("BELOW", 100, usd(edge))).toBe(true);
    expect(isPriceConditionCleared("BELOW", 100, usd(edge - 0.01))).toBe(false);
  });
});

describe("nextPriceAlertAction", () => {
  it("should fire an armed alert whose condition is true", () => {
    expect(nextPriceAlertAction("ABOVE", true, 100, usd(101))).toBe("FIRE");
  });

  it("should leave an armed alert whose condition is false", () => {
    expect(nextPriceAlertAction("ABOVE", true, 100, usd(99))).toBe("NONE");
  });

  it("should stay quiet while a fired alert's condition remains true", () => {
    expect(nextPriceAlertAction("ABOVE", false, 100, usd(105))).toBe("NONE");
  });

  it("should stay quiet between the threshold and the band", () => {
    expect(nextPriceAlertAction("ABOVE", false, 100, usd(99.8))).toBe("NONE");
  });

  it("should re-arm a fired alert once the price is past the band", () => {
    expect(nextPriceAlertAction("ABOVE", false, 100, usd(99.4))).toBe("REARM");
    expect(nextPriceAlertAction("BELOW", false, 100, usd(100.6))).toBe("REARM");
  });

  it("should fire only once while the price oscillates around the threshold", () => {
    const prices = [101, 99.9, 100.2, 99.8, 100.1];
    let armed = true;
    let fired = 0;
    for (const value of prices) {
      const action = nextPriceAlertAction("ABOVE", armed, 100, usd(value));
      if (action === "FIRE") {
        fired += 1;
        armed = false;
      } else if (action === "REARM") {
        armed = true;
      }
    }
    expect(fired).toBe(1);
  });
});

describe("initialAlertArmed", () => {
  it("should start disarmed when the condition is already true", () => {
    expect(initialAlertArmed("ABOVE", 100, usd(150))).toBe(false);
    expect(initialAlertArmed("BELOW", 100, usd(50))).toBe(false);
  });

  it("should start armed when the condition is false", () => {
    expect(initialAlertArmed("ABOVE", 100, usd(90))).toBe(true);
  });

  it("should start armed when there is no price yet", () => {
    expect(initialAlertArmed("ABOVE", 100, null)).toBe(true);
  });
});
