import type { Money } from "../value-objects/money.js";

/**
 * The largest contributor and the largest detractor of a period.
 * Source: docs/02-functional-requirements.md FR-006, ADR-010 point 1.
 *
 * Works on the contributions of the range attribution (`16-analytics-spec.md` §14).
 * Pure and deterministic (NFR-042): it never reads the clock or a repository.
 */

/** One asset's contribution to the period P/L, with the symbol that breaks ties. */
export interface SymbolContribution {
  assetId: string;
  symbol: string;
  contribution: Money;
}

export interface TopContributors {
  /** The largest contribution above zero; `null` when none is above zero. */
  contributor: SymbolContribution | null;
  /** The largest loss, below zero; `null` when none is below zero. */
  detractor: SymbolContribution | null;
}

/**
 * Picks the largest contributor (a contribution above zero) and the largest
 * detractor (below zero). When every contribution is `>= 0` there is no
 * detractor, and when every one is `<= 0` there is no contributor. A tie goes to
 * the alphabetically first symbol, whatever the order of `items`.
 */
export function pickTopContributors(items: readonly SymbolContribution[]): TopContributors {
  const bySymbol = [...items].sort((a, b) =>
    a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0,
  );

  let contributor: SymbolContribution | null = null;
  let detractor: SymbolContribution | null = null;

  for (const item of bySymbol) {
    // Strict comparisons keep the first of equals, which is the first symbol.
    if (
      item.contribution.isPositive() &&
      (contributor === null || item.contribution.greaterThan(contributor.contribution))
    ) {
      contributor = item;
    }
    if (
      item.contribution.isNegative() &&
      (detractor === null || item.contribution.lessThan(detractor.contribution))
    ) {
      detractor = item;
    }
  }

  return { contributor, detractor };
}
