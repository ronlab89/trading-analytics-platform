import type { DecisionResponse } from "@trading/contracts";
import { useMemo, useState } from "react";
import { historyRangeOf } from "../lib/price-series";
import { useAssetHistory } from "./use-asset-history";

/**
 * The daily candles of the asset of a decision, from the day it was made to the day it closed, or to
 * today while it is open. Every panel of the page that needs the prices calls this and they share one
 * request, because the query is the same. "Today" is read once, when the page opens, so the panels
 * never end up asking for different ranges.
 */
export function useDecisionHistory(
  decision: Pick<DecisionResponse, "assetId" | "createdAt" | "closedAt">,
) {
  const [now] = useState(() => new Date());
  const { assetId, createdAt, closedAt } = decision;
  const range = useMemo(
    () => historyRangeOf({ createdAt, closedAt }, now),
    [createdAt, closedAt, now],
  );

  return { range, history: useAssetHistory(assetId, range) };
}
