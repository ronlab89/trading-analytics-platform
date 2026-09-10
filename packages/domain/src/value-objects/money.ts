import { Decimal } from "decimal.js";

/**
 * Money value object.
 * Source: docs/05-data-model.md §39 ("Monetary Precision")
 *
 * Pairs an arbitrary-precision decimal amount with a currency code.
 * Backed by decimal.js to avoid IEEE 754 floating-point errors in
 * authoritative financial calculations (see 04-tech-stack.md §28.1).
 *
 * Money is immutable: every operation returns a new Money instance.
 * Arithmetic between two Money instances is only allowed when their
 * currencies match — mixing currencies without an explicit conversion
 * step is a domain error, not something this type silently resolves.
 */

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Cannot operate on different currencies: ${a} and ${b}.`);
    this.name = "CurrencyMismatchError";
  }
}

function isValidCurrencyCode(currency: string): boolean {
  return currency.length === 3 && currency === currency.toUpperCase();
}

export class Money {
  private readonly amount: Decimal;
  readonly currency: string;

  private constructor(amount: Decimal, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  /**
   * Creates a Money instance from a number or numeric string.
   *
   * A string input is preferred when the source value could already
   * have lost precision as a JS number (e.g. values read from an API
   * payload as text). Numeric input is accepted for convenience in
   * tests and simple call sites.
   */
  static of(amount: number | string, currency: string): Money {
    if (!isValidCurrencyCode(currency)) {
      throw new InvalidMoneyError("Currency must be a 3-letter uppercase currency code.");
    }

    let decimalAmount: Decimal;
    try {
      decimalAmount = new Decimal(amount);
    } catch {
      throw new InvalidMoneyError(`Invalid monetary amount: ${String(amount)}`);
    }

    if (!decimalAmount.isFinite()) {
      throw new InvalidMoneyError(`Invalid monetary amount: ${String(amount)}`);
    }

    return new Money(decimalAmount, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /**
   * Multiplies this Money by a plain scalar factor (e.g. a quantity).
   * The factor is not itself a Money — it has no currency.
   */
  multiply(factor: number | string): Money {
    return new Money(this.amount.times(factor), this.currency);
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  isPositive(): boolean {
    return this.amount.isPositive() && !this.amount.isZero();
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.greaterThan(other.amount);
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.lessThan(other.amount);
  }

  /**
   * Returns the amount as a JS number. This may lose precision for
   * very large or very high-precision values — intended for display
   * or interop with APIs that require a primitive number, not for
   * further authoritative calculation.
   */
  toNumber(): number {
    return this.amount.toNumber();
  }

  /**
   * Returns the exact decimal amount as a string, safe for persistence
   * or serialization without precision loss.
   */
  toString(): string {
    return this.amount.toString();
  }

  toFixed(decimalPlaces: number): string {
    return this.amount.toFixed(decimalPlaces);
  }
}
