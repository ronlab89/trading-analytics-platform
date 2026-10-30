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
