import type { DecisionResponse } from "@trading/contracts";
import type { DecisionRow } from "../types";

/**
 * The decision as the list shows it: with the symbol and name of its asset, and open until it has a
 * closing date. An asset that is not known leaves a null symbol and name instead of hiding the row.
 */
export function toDecisionRow(
  decision: DecisionResponse,
  asset: { symbol: string; name: string } | undefined,
): DecisionRow {
  return {
    id: decision.id,
    title: decision.title,
    symbol: asset?.symbol ?? null,
    name: asset?.name ?? null,
    direction: decision.direction,
    entryPrice: decision.entryPrice,
    targetPrice: decision.targetPrice,
    stopPrice: decision.stopPrice,
    riskLevel: decision.riskLevel,
    createdAt: decision.createdAt,
    outcome: decision.outcome,
    status: decision.closedAt === null ? "OPEN" : "CLOSED",
  };
}
