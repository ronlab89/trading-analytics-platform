import type { AllocationResponse, MoneyDto } from "@trading/contracts";

export interface AllocationSlice {
  key: string;
  label: string;
  marketValue: MoneyDto;
  /** Share of the portfolio, 0 to 100. */
  percentage: number;
}

/** The key of the slice that adds up everything beyond the largest groups. */
export const OTHERS_KEY = "others";

/**
 * The groups of an allocation as the slices the distribution draws: the largest ones in order and,
 * when there are more than `max`, one last slice that adds up the rest under `othersLabel`. The
 * amounts are only added for display, so reading them as numbers loses nothing that matters.
 */
export function toAllocationSlices(
  groups: AllocationResponse["groups"],
  max: number,
  othersLabel: string,
): AllocationSlice[] {
  const sorted = [...groups].sort((a, b) => b.percentage - a.percentage);
  if (sorted.length <= max) return sorted;

  const kept = sorted.slice(0, max - 1);
  const rest = sorted.slice(max - 1);
  const [first] = rest;
  if (first === undefined) return kept;
  const amount = rest.reduce((sum, group) => sum + Number(group.marketValue.amount), 0);
  return [
    ...kept,
    {
      key: OTHERS_KEY,
      label: othersLabel,
      marketValue: { amount: amount.toFixed(2), currency: first.marketValue.currency },
      percentage: rest.reduce((sum, group) => sum + group.percentage, 0),
    },
  ];
}
