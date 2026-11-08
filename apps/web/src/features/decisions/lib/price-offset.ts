import type { MoneyDto } from "@trading/contracts";

/**
 * How far a price is from the entry, in percentage points (`+17` for a target 17 % above it). The
 * amounts are only compared for display, so reading them as numbers loses nothing that matters. It
 * has no answer (null) when the decision sets no entry or no price, or when the entry is zero.
 */
export function percentFromEntry(entry: MoneyDto | null, price: MoneyDto | null): number | null {
  if (entry === null || price === null) return null;
  const base = Number(entry.amount);
  if (base === 0) return null;
  return ((Number(price.amount) - base) / base) * 100;
}
