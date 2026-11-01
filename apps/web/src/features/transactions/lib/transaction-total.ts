import type { MoneyDto } from "@trading/contracts";

/**
 * The total of a transaction as the Figma shows it: quantity times price, with the fees apart in
 * their own column (10 × $180.20 is $1,802.00, and its $1.00 fee is not part of it). Rounded to
 * cents, so a quantity with decimals does not leave a float tail in the amount.
 */
export function transactionTotal(price: MoneyDto, quantity: number): MoneyDto {
  const cents = Math.round(Number(price.amount) * quantity * 100);
  return { amount: (cents / 100).toFixed(2), currency: price.currency };
}
