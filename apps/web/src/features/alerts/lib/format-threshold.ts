import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { AlertRow } from "./alert-row";
import { plainDecimal } from "./plain-decimal";

/**
 * The threshold of an alert as the user reads it: an amount in the currency of its asset. While the
 * asset is not known there is no currency to write it in, so it shows as a plain number.
 */
export function formatThreshold({ threshold, currency }: Pick<AlertRow, "threshold" | "currency">) {
  if (currency === null) return formatQuantity(threshold);
  return formatMoney({ amount: plainDecimal(threshold), currency });
}
