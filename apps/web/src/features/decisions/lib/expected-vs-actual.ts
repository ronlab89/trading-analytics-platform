import type { DecisionResponse, MoneyDto } from "@trading/contracts";
import type { PriceCursor, PricePoint } from "./price-series";

export type PriceMove = "UP" | "DOWN" | "FLAT";

/** The worst the price did against the position: nothing to say, never against it, or by how much. */
export type WorstFall = { kind: "none" } | { kind: "calm" } | { kind: "drawdown"; percent: number };

export interface ExpectedVsActual {
  direction: { expected: DecisionResponse["direction"]; actual: PriceMove | null };
  target: {
    expected: MoneyDto | null;
    /** The close on the day of the current event. */
    price: number | null;
    /** How much of the way from the entry to the target that close covers, in percent. */
    progress: number | null;
  };
  risk: { expected: DecisionResponse["riskLevel"]; actual: WorstFall };
  result: { expected: number | null; actual: number | null };
}

interface ExpectedVsActualInput {
  decision: Pick<DecisionResponse, "direction" | "entryPrice" | "targetPrice" | "riskLevel">;
  points: readonly PricePoint[];
  cursor: PriceCursor | null;
  /** When the position was opened; null while no event opens one. */
  openedAt: string | null;
}

const amountOf = (price: MoneyDto | null) => (price === null ? null : Number(price.amount));

const percentOver = (base: number, value: number) => ((value - base) / base) * 100;

/**
 * What the decision expected against what the price has done up to the event the replay is on. The
 * real column only exists from the day the position opened, at the entry price of the decision; before
 * that, or without an entry or a price for that day, there is nothing real to say and it is left empty
 * rather than made up. A short gains when the price falls, so its percentages are turned around and
 * the worst fall is the worst rise. The direction is the plain move of the price, so it can be read
 * against the direction that was expected.
 */
export function expectedVsActual({
  decision,
  points,
  cursor,
  openedAt,
}: ExpectedVsActualInput): ExpectedVsActual {
  const entryAmount = amountOf(decision.entryPrice);
  const entry = entryAmount === null || entryAmount === 0 ? null : entryAmount;
  const target = amountOf(decision.targetPrice);
  const sign = decision.direction === "SHORT" ? -1 : 1;
  const openedDay = openedAt?.slice(0, 10) ?? null;

  const expectedResult =
    entry === null || target === null ? null : sign * percentOver(entry, target) + 0;
  const base = {
    direction: { expected: decision.direction, actual: null },
    target: { expected: decision.targetPrice, price: null, progress: null },
    risk: { expected: decision.riskLevel, actual: { kind: "none" } },
    result: { expected: expectedResult, actual: null },
  } satisfies ExpectedVsActual;

  if (entry === null || cursor === null || openedDay === null || cursor.date < openedDay) {
    return base;
  }

  const sinceOpened = points.slice(0, cursor.index + 1).filter((point) => point.date >= openedDay);
  const worst = Math.min(...sinceOpened.map((point) => sign * percentOver(entry, point.close)));
  const move: PriceMove = cursor.close > entry ? "UP" : cursor.close < entry ? "DOWN" : "FLAT";

  return {
    direction: { expected: decision.direction, actual: move },
    target: {
      expected: decision.targetPrice,
      price: cursor.close,
      progress:
        target === null || target === entry
          ? null
          : ((cursor.close - entry) / (target - entry)) * 100,
    },
    risk: {
      expected: decision.riskLevel,
      actual: worst < 0 ? { kind: "drawdown", percent: worst } : { kind: "calm" },
    },
    result: { expected: expectedResult, actual: sign * percentOver(entry, cursor.close) + 0 },
  };
}
