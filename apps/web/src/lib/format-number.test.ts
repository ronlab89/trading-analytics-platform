import { describe, expect, it } from "vitest";
import {
  currencySymbol,
  formatMoney,
  formatQuantity,
  formatSignedMoney,
  formatSignedPercent,
} from "./format-number";

describe("formatSignedMoney", () => {
  it("writes a gain with a plus and a loss with a minus before the symbol", () => {
    expect(formatSignedMoney({ amount: "2340.10", currency: "USD" })).toBe("+$2,340.10");
    expect(formatSignedMoney({ amount: "-1958.00", currency: "USD" })).toBe("-$1,958.00");
  });

  it("writes zero without a sign", () => {
    expect(formatSignedMoney({ amount: "0.00", currency: "USD" })).toBe("$0.00");
  });

  it("does not round an amount through a floating point number", () => {
    expect(formatSignedMoney({ amount: "12345678901234567.89", currency: "USD" })).toBe(
      "+$12,345,678,901,234,567.89",
    );
  });
});

describe("formatSignedPercent", () => {
  it("writes percentage points with two decimals and the sign of the change", () => {
    expect(formatSignedPercent(1.9)).toBe("+1.90%");
    expect(formatSignedPercent(-0.8)).toBe("-0.80%");
    expect(formatSignedPercent(17)).toBe("+17.00%");
  });

  it("writes zero without a sign", () => {
    expect(formatSignedPercent(0)).toBe("0.00%");
  });

  it("does not show a minus for a change that rounds to zero", () => {
    expect(formatSignedPercent(-0.001)).toBe("0.00%");
  });
});

describe("formatMoney", () => {
  it("writes the currency symbol, the thousands separators and two decimals", () => {
    expect(formatMoney({ amount: "125430.25", currency: "USD" })).toBe("$125,430.25");
    expect(formatMoney({ amount: "162.4", currency: "USD" })).toBe("$162.40");
    expect(formatMoney({ amount: "1", currency: "USD" })).toBe("$1.00");
  });

  it("keeps the decimals of a price that has more than two", () => {
    expect(formatMoney({ amount: "0.00001234", currency: "USD" })).toBe("$0.00001234");
  });

  it("does not round an amount through a floating point number", () => {
    expect(formatMoney({ amount: "12345678901234567.89", currency: "USD" })).toBe(
      "$12,345,678,901,234,567.89",
    );
  });

  it("uses the symbol of the currency of the amount", () => {
    expect(formatMoney({ amount: "10.5", currency: "EUR" })).toBe("€10.50");
    expect(formatMoney({ amount: "10.5", currency: "GBP" })).toBe("£10.50");
  });

  it("writes a negative amount with its sign before the symbol", () => {
    expect(formatMoney({ amount: "-1958.00", currency: "USD" })).toBe("-$1,958.00");
  });
});

describe("formatQuantity", () => {
  it("writes a whole quantity with thousands separators and no decimals", () => {
    expect(formatQuantity(236)).toBe("236");
    expect(formatQuantity(17560)).toBe("17,560");
  });

  it("keeps the decimals of a fractional quantity, up to eight", () => {
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(0.12345678)).toBe("0.12345678");
  });
});

describe("currencySymbol", () => {
  it("gives the symbol an amount of the currency is written with", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
  });
});
