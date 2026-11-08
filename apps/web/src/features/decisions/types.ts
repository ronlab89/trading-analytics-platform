import type { DecisionResponse } from "@trading/contracts";

export type DecisionStatus = "OPEN" | "CLOSED";

/**
 * What a decision looks like to the table that lists it: the decision with the symbol and name of
 * its asset, and whether it is still open. An asset that is not known leaves a null symbol and name
 * instead of hiding the row.
 */
export interface DecisionRow {
  id: string;
  title: string;
  symbol: string | null;
  name: string | null;
  direction: DecisionResponse["direction"];
  entryPrice: DecisionResponse["entryPrice"];
  targetPrice: DecisionResponse["targetPrice"];
  stopPrice: DecisionResponse["stopPrice"];
  riskLevel: string | null;
  createdAt: string;
  /** Free text: the API does not say more about how a decision ended. */
  outcome: string | null;
  status: DecisionStatus;
}
