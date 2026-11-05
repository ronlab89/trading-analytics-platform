import { formatMoney, formatQuantity } from "@/lib/format-number";
import type { AlertRow } from "./alert-row";

/**
 * The threshold of an alert as the user reads it: an amount in the currency of its asset. While the
 * asset is not known there is no currency to write it in, so it shows as a plain number.
 */
export function formatThreshold({ threshold, currency }: Pick<AlertRow, "threshold" | "currency">) {
  if (currency === null) return formatQuantity(threshold);
  // A threshold with more than cents keeps its digits; `String` would write a tiny one as `1e-7`.
  const amount = Number.isInteger(threshold * 100) ? threshold.toFixed(2) : threshold.toFixed(8);
  return formatMoney({ amount: amount.replace(/(\.\d*?[1-9])0+$/, "$1"), currency });
}
