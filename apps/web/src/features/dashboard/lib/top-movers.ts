import type { OverviewResponse } from "@trading/contracts";

export interface Mover {
  symbol: string;
  /** What the position moved today, in percentage points. */
  percent: number;
}

type OverviewPosition = OverviewResponse["positions"][number];

/**
 * The positions that moved the most today, biggest move first whichever way it went. A position
 * with no change (no price for the day yet) or whose asset is not known is left out, because
 * there is nothing to draw or to call it by.
 */
export function topMovers(positions: readonly OverviewPosition[], count: number): Mover[] {
  return positions
    .flatMap(({ asset, dailyChange }) =>
      asset === null || dailyChange === null
        ? []
        : [{ symbol: asset.symbol, percent: dailyChange.changePercent }],
    )
    .sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent))
    .slice(0, count);
}
