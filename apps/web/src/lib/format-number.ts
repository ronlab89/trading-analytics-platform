import type { MoneyDto } from "@trading/contracts";

/**
 * The numbers are written the way the Figma draws them in both languages (`$125,430.25`,
 * `17,560`), so the locale is fixed. Formatting by the active language is part of the language
 * selection, which is still planned (`15-implementation-plan.md`, FE0).
 */
const LOCALE = "en-US";
const MONEY_DECIMALS = 2;
const QUANTITY_DECIMALS = 8;

const moneyFormats = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, decimals: number) {
  const key = `${currency}:${String(decimals)}`;
  let format = moneyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: MONEY_DECIMALS,
      maximumFractionDigits: decimals,
    });
    moneyFormats.set(key, format);
  }
  return format;
}

/**
 * An amount with its currency symbol and at least two decimals; a price with more keeps them. The
 * amount is a decimal string (ADR-002 point 9) and goes to `Intl` as it is, so a large amount is
 * not rounded through a floating point number.
 */
export function formatMoney({ amount, currency }: MoneyDto): string {
  const decimals = Math.max(MONEY_DECIMALS, amount.split(".")[1]?.length ?? 0);
  // `moneySchema` already guarantees a fixed-notation decimal, which is what `StringNumericLiteral` names.
  return moneyFormat(currency, decimals).format(amount as `${number}`);
}

const quantityFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: QUANTITY_DECIMALS });

/** A quantity of an asset: whole numbers without decimals, fractions up to eight. */
export function formatQuantity(quantity: number): string {
  return quantityFormat.format(quantity);
}

/** The symbol of a currency as an amount of it is written (`$` for USD, `€` for EUR). */
export function currencySymbol(currency: string): string {
  return (
    moneyFormat(currency, MONEY_DECIMALS)
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

const signedMoneyFormats = new Map<string, Intl.NumberFormat>();

/**
 * A change in money, signed: `+$2,340.10` for a gain, `-$1,958.00` for a loss and `$0.00` for none.
 * Like `formatMoney`, the amount goes to `Intl` as the decimal string it is.
 */
export function formatSignedMoney({ amount, currency }: MoneyDto): string {
  const decimals = Math.max(MONEY_DECIMALS, amount.split(".")[1]?.length ?? 0);
  const key = `${currency}:${String(decimals)}`;
  let format = signedMoneyFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      signDisplay: "exceptZero",
      minimumFractionDigits: MONEY_DECIMALS,
      maximumFractionDigits: decimals,
    });
    signedMoneyFormats.set(key, format);
  }
  return format.format(amount as `${number}`);
}

const signedPercentFormat = new Intl.NumberFormat(LOCALE, {
  signDisplay: "exceptZero",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Percentage points as the API sends them (`1.9` is 1.9 %), signed and with two decimals. A change
 * that rounds to zero is written as zero, not as `-0.00%`.
 */
export function formatSignedPercent(points: number): string {
  const rounded = Math.round(points * 100) / 100;
  return `${signedPercentFormat.format(rounded === 0 ? 0 : rounded)}%`;
}

const THOUSAND = 1_000;
const MILLION = 1_000_000;

function trimmed(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * An amount short enough for a chart axis: `$124k`, `$1.2M`, `$800`. It is only a label to read a
 * scale by, so it rounds to one decimal and never shows cents.
 */
export function formatAxisMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currencySymbol(currency);
  if (abs >= MILLION) return `${sign}${symbol}${trimmed(abs / MILLION)}M`;
  if (abs >= THOUSAND) return `${sign}${symbol}${trimmed(abs / THOUSAND)}k`;
  return `${sign}${symbol}${String(Math.round(abs))}`;
}

const percentFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Percentage points as the API sends them (`14.2` is 14.2 %), with one decimal and a minus sign
 * only when negative: the figure of a risk or a weight, which is not a change to sign. A value
 * that rounds to zero is written as zero, not as `-0.0%`.
 */
export function formatPercent(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  return `${percentFormat.format(rounded === 0 ? 0 : rounded)}%`;
}
