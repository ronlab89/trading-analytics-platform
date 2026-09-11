import { describe, expect, it } from "vitest";
import { CurrencyMismatchError, InvalidMoneyError, Money } from "./money";

describe("Money.of", () => {
  it("should create a valid Money instance", () => {
    const money = Money.of(100.5, "USD");
    expect(money.toNumber()).toBe(100.5);
    expect(money.currency).toBe("USD");
  });

  it("should accept a string amount without losing precision", () => {
    const money = Money.of("0.1", "USD").add(Money.of("0.2", "USD"));
    expect(money.toString()).toBe("0.3");
  });

  it("should reject a lowercase currency code", () => {
    expect(() => Money.of(100, "usd")).toThrow(InvalidMoneyError);
  });

  it("should reject a currency code that is not 3 letters", () => {
    expect(() => Money.of(100, "US")).toThrow(InvalidMoneyError);
  });

  it("should reject a non-finite amount", () => {
    expect(() => Money.of(Infinity, "USD")).toThrow(InvalidMoneyError);
  });

  it("should reject a NaN amount", () => {
    expect(() => Money.of(NaN, "USD")).toThrow(InvalidMoneyError);
  });
});

describe("Money.zero", () => {
  it("should create a zero-value Money instance", () => {
    expect(Money.zero("USD").isZero()).toBe(true);
  });
});

describe("Money arithmetic", () => {
  it("should add two Money instances of the same currency", () => {
    const result = Money.of(100, "USD").add(Money.of(50, "USD"));
    expect(result.toNumber()).toBe(150);
  });

  it("should subtract two Money instances of the same currency", () => {
    const result = Money.of(100, "USD").subtract(Money.of(30, "USD"));
    expect(result.toNumber()).toBe(70);
  });

  it("should multiply Money by a scalar factor", () => {
    const result = Money.of(150, "USD").multiply(10);
    expect(result.toNumber()).toBe(1500);
  });

  it("should reject adding two different currencies", () => {
    expect(() => Money.of(100, "USD").add(Money.of(50, "EUR"))).toThrow(CurrencyMismatchError);
  });

  it("should reject subtracting two different currencies", () => {
    expect(() => Money.of(100, "USD").subtract(Money.of(50, "EUR"))).toThrow(CurrencyMismatchError);
  });

  it("should avoid classic floating-point precision errors", () => {
    // 0.1 + 0.2 !== 0.3 with plain JS numbers.
    const result = Money.of(0.1, "USD").add(Money.of(0.2, "USD"));
    expect(result.toNumber()).toBe(0.3);
  });
});

describe("Money comparisons", () => {
  it("should report equality for equal amount and currency", () => {
    expect(Money.of(100, "USD").equals(Money.of(100, "USD"))).toBe(true);
  });

  it("should report inequality for different amounts", () => {
    expect(Money.of(100, "USD").equals(Money.of(101, "USD"))).toBe(false);
  });

  it("should report inequality for different currencies", () => {
    expect(Money.of(100, "USD").equals(Money.of(100, "EUR"))).toBe(false);
  });

  it("should detect a negative amount", () => {
    expect(Money.of(-1, "USD").isNegative()).toBe(true);
  });

  it("should compare greater than", () => {
    expect(Money.of(150, "USD").greaterThan(Money.of(100, "USD"))).toBe(true);
  });

  it("should compare less than", () => {
    expect(Money.of(50, "USD").lessThan(Money.of(100, "USD"))).toBe(true);
  });

  it("should reject comparing different currencies", () => {
    expect(() => Money.of(100, "USD").greaterThan(Money.of(50, "EUR"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("should detect a positive amount", () => {
    expect(Money.of(1, "USD").isPositive()).toBe(true);
  });

  it("should not consider zero as positive", () => {
    expect(Money.of(0, "USD").isPositive()).toBe(false);
  });
});

describe("Money formatting", () => {
  it("should format to a fixed number of decimal places", () => {
    expect(Money.of(100, "USD").toFixed(2)).toBe("100.00");
  });

  it("should serialize to an exact decimal string", () => {
    expect(Money.of("99.999", "USD").toString()).toBe("99.999");
  });
});
