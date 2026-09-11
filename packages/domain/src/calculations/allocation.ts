import type { Position } from "../entities/position";
import { Money } from "../value-objects/money";

/**
 * Allocation calculations.
 * Source: docs/06-architecture.md §10, docs/05-data-model.md §26,
 * docs/02-functional-requirements.md FR-027.
 *
 * §26 and FR-027 describe grouping allocation by asset, asset type,
 * sector or currency. Position alone only carries `assetId` — it does
 * not carry assetType/sector (those live on the Asset entity) or a
 * standalone currency field (that's `averageEntryPrice.currency` /
 * `currentPrice.currency`).
 *
 * Rather than hard-coding one dimension or pulling Asset[] in as a
 * required dependency of this calculation module, this function is
 * generic over a `groupBy` callback supplied by the caller. This keeps
 * the calculations module decoupled from the Asset entity while still
 * supporting every dimension named in the spec:
 *
 *   groupBy: (position) => position.assetId          → by asset
 *   groupBy: (position) => assetsById[position.assetId].assetType
 *                                                      → by asset type
 *   groupBy: (position) => assetsById[position.assetId].metadata.sector
 *                                                      → by sector
 *   groupBy: (position) => position.currentPrice.currency
 *                                                      → by currency
 *
 * Resolving assetType/sector from an asset lookup is the caller's
 * responsibility — this module does not depend on the Asset entity.
 */

export interface AllocationGroup {
  readonly key: string;
  readonly marketValue: Money;
  readonly percentage: number;
}

/**
 * Calculates allocation groups from a list of positions.
 *
 * Percentages are calculated independently per group
 * (groupValue / totalValue * 100) and are NOT rebalanced to force an
 * exact sum of 100 — doing so would mean adjusting a group's reported
 * value to make the total look clean, which this project treats as
 * fabricating data (15-implementation-plan.md §2, "do not invent
 * metrics"). Minor floating-point drift in the sum is expected and
 * acceptable.
 *
 * An empty position list returns an empty array of groups.
 *
 * Positions across different currencies will cause `Money.add()` to
 * throw `CurrencyMismatchError`, which is allowed to propagate to the
 * calling application layer (06-architecture.md §29) — this module
 * does not perform currency conversion.
 */
export function calculateAllocation(
  positions: readonly Position[],
  groupBy: (position: Position) => string,
): AllocationGroup[] {
  if (positions.length === 0) {
    return [];
  }

  const firstPosition = positions[0];
  if (!firstPosition) {
    return [];
  }
  const currency = firstPosition.currentPrice.currency;
  const valueByKey = new Map<string, Money>();

  for (const position of positions) {
    const key = groupBy(position);
    const marketValue = position.currentPrice.multiply(position.quantity);
    const existing = valueByKey.get(key) ?? Money.zero(currency);
    valueByKey.set(key, existing.add(marketValue));
  }

  const totalValue = Array.from(valueByKey.values()).reduce(
    (total, value) => total.add(value),
    Money.zero(currency),
  );

  return Array.from(valueByKey.entries()).map(([key, marketValue]) => ({
    key,
    marketValue,
    percentage: totalValue.isZero() ? 0 : (marketValue.toNumber() / totalValue.toNumber()) * 100,
  }));
}
