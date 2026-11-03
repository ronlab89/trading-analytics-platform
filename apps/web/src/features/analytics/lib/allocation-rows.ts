import type { AllocationResponse, MoneyDto } from "@trading/contracts";

export interface AllocationRow {
  key: string;
  label: string;
  marketValue: MoneyDto;
  /** Share of the portfolio, 0 to 100. */
  percentage: number;
}

export interface AllocationRows {
  /** Every group, the largest first. */
  rows: AllocationRow[];
  /** What the groups add up to, for the line under the title. */
  invested: MoneyDto;
}

/**
 * The groups of an allocation as the rows of the analytics panel: the largest first, and the total
 * they add up to. The amounts are only added for display, so reading them as numbers loses nothing
 * that matters. An allocation with no groups has nothing to list (null).
 */
export function toAllocationRows(groups: AllocationResponse["groups"]): AllocationRows | null {
  const [first] = groups;
  if (first === undefined) return null;

  const rows = [...groups].sort((a, b) => b.percentage - a.percentage);
  const total = rows.reduce((sum, row) => sum + Number(row.marketValue.amount), 0);
  return {
    rows,
    invested: { amount: total.toFixed(2), currency: first.marketValue.currency },
  };
}
