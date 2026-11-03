import type { MoneyDto, RangeAttributionResponse } from "@trading/contracts";

export type ContributionDirection = "GAIN" | "LOSS" | "FLAT";

export interface AttributionRow {
  key: string;
  label: string;
  contribution: MoneyDto;
  direction: ContributionDirection;
  /** How long the bar is: this contribution over the largest one, 0 to 1. */
  share: number;
}

/**
 * The groups of a range attribution as the rows of the analytics table: the asset that added the
 * most first and the one that took the most away last, each with the direction of its contribution
 * and a bar length against the largest one (by size, whatever its sign). The amounts are only
 * compared for display, so reading them as numbers loses nothing that matters. A range with no
 * groups has nothing to list (null).
 */
export function toAttributionRows(
  groups: RangeAttributionResponse["groups"],
): AttributionRow[] | null {
  if (groups.length === 0) return null;

  const amounts = groups.map((group) => ({ group, value: Number(group.contribution.amount) }));
  const largest = Math.max(...amounts.map(({ value }) => Math.abs(value)));

  return amounts
    .sort((a, b) => b.value - a.value)
    .map(({ group, value }) => ({
      key: group.key,
      label: group.label,
      contribution: group.contribution,
      direction: value > 0 ? "GAIN" : value < 0 ? "LOSS" : "FLAT",
      share: largest === 0 ? 0 : Math.abs(value) / largest,
    }));
}
