import { describe, expect, it } from "vitest";
import { AlertType } from "./enums";
import { InvalidAlertError, validateNewAlert } from "./alert";

const baseInput = {
  userId: "user_001",
  assetId: "asset_001",
  type: AlertType.PRICE,
  condition: "ABOVE",
  threshold: 200,
};

describe("validateNewAlert", () => {
  it("should accept a valid price alert with an assetId", () => {
    expect(() => {
      validateNewAlert(baseInput);
    }).not.toThrow();
  });

  it("should accept a valid alert with only a portfolioId", () => {
    expect(() => {
      validateNewAlert({
        userId: "user_001",
        type: AlertType.PORTFOLIO_CHANGE,
        condition: "ABOVE",
        threshold: 5,
        portfolioId: "portfolio_001",
      });
    }).not.toThrow();
  });

  it("should reject a missing userId", () => {
    expect(() => {
      validateNewAlert({ ...baseInput, userId: "" });
    }).toThrow(InvalidAlertError);
  });

  it("should reject an unsupported alert type", () => {
    expect(() => {
      validateNewAlert({
        ...baseInput,
        // @ts-expect-error intentionally invalid for the test
        type: "UNKNOWN",
      });
    }).toThrow(InvalidAlertError);
  });

  it("should reject a missing condition", () => {
    expect(() => {
      validateNewAlert({ ...baseInput, condition: "" });
    }).toThrow(InvalidAlertError);
  });

  it("should reject an alert without an assetId or portfolioId", () => {
    expect(() => {
      validateNewAlert({
        userId: "user_001",
        type: AlertType.VOLATILITY,
        condition: "ABOVE",
        threshold: 10,
      });
    }).toThrow(InvalidAlertError);
  });
});
