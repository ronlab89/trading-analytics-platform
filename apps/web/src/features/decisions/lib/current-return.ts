import type { DecisionReplayStateResponse, DecisionResponse, MoneyDto } from "@trading/contracts";
import { percentFromEntry } from "./price-offset";

export type CurrentReturn =
  | { kind: "none" }
  | { kind: "open"; percent: number; price: MoneyDto }
  | { kind: "closed"; profit: MoneyDto; price: MoneyDto | null };

/**
 * How a decision is doing at one state of its replay. An open position is measured in percent from
 * its own entry to the last price, and a short gains when the price falls. A closed one has no entry
 * left in the state, since it may have been adjusted on the way, so it says the profit or loss the
 * projection already added up. Nothing is opened, nothing to measure.
 */
export function currentReturnOf(
  state: DecisionReplayStateResponse,
  direction: DecisionResponse["direction"],
): CurrentReturn {
  if (state.phase === "CLOSED" && state.realizedPnL !== null) {
    return { kind: "closed", profit: state.realizedPnL, price: state.lastPrice };
  }

  const percent = percentFromEntry(state.position?.entryPrice ?? null, state.lastPrice);
  if (percent === null || state.lastPrice === null) return { kind: "none" };

  return {
    kind: "open",
    percent: direction === "SHORT" ? -percent : percent,
    price: state.lastPrice,
  };
}
