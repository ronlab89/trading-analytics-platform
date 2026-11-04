import type { DecisionResponse, HistoricalPriceResponse, MoneyDto } from "@trading/contracts";

export interface PricePoint {
  /** The calendar day of the candle, `YYYY-MM-DD`. */
  date: string;
  close: number;
  /** The close while the day has already happened in the replay; null otherwise. */
  played: number | null;
  /** The close while the day is still to come in the replay; null otherwise. */
  upcoming: number | null;
}

export interface PriceCursor {
  date: string;
  close: number;
  index: number;
}

export interface PriceLevel {
  key: "target" | "entry" | "stop";
  price: MoneyDto;
  value: number;
}

const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * The closes of an asset as the two parts of one line: what has already happened at the event the
 * replay is on, and what is still to come. The day of the event belongs to both, so they join. On a
 * day with no candle, such as a weekend, the replay stands on the last day that has one. Candles are
 * read as they come, oldest first, and are only read as numbers to be drawn.
 */
export function toPriceSeries(
  candles: readonly HistoricalPriceResponse[],
  eventTimestamp: string | null,
): { points: PricePoint[]; cursor: PriceCursor | null } {
  const eventDay = eventTimestamp === null ? null : dayOf(eventTimestamp);
  const cursorIndex =
    eventDay === null
      ? -1
      : candles.reduce(
          (found, candle, index) => (dayOf(candle.timestamp) <= eventDay ? index : found),
          -1,
        );

  const points = candles.map((candle, index): PricePoint => {
    const close = Number(candle.close.amount);
    return {
      date: dayOf(candle.timestamp),
      close,
      played: index <= cursorIndex ? close : null,
      upcoming: index >= cursorIndex ? close : null,
    };
  });

  const current = points[cursorIndex];
  return {
    points,
    cursor:
      current === undefined
        ? null
        : { date: current.date, close: current.close, index: cursorIndex },
  };
}

/** The prices the decision sets, highest first as the Figma stacks them; an unset one is left out. */
export function priceLevelsOf(
  decision: Pick<DecisionResponse, "targetPrice" | "entryPrice" | "stopPrice">,
): PriceLevel[] {
  const levels: { key: PriceLevel["key"]; price: MoneyDto | null }[] = [
    { key: "target", price: decision.targetPrice },
    { key: "entry", price: decision.entryPrice },
    { key: "stop", price: decision.stopPrice },
  ];

  return levels.flatMap(({ key, price }) =>
    price === null ? [] : [{ key, price, value: Number(price.amount) }],
  );
}

const ROOM = 0.1;

/** The scale that fits the line and the levels, with room so nothing sits on the edge. */
export function priceDomain(
  points: readonly Pick<PricePoint, "close">[],
  levels: readonly Pick<PriceLevel, "value">[],
): [number, number] {
  const values = [...points.map((point) => point.close), ...levels.map((level) => level.value)];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const room = high === low ? Math.abs(high) * ROOM || 1 : (high - low) * ROOM;

  return [low - room, high + room];
}

/** The days the chart covers: from the day of the decision to the day it closed, or to today. */
export function historyRangeOf(
  decision: Pick<DecisionResponse, "createdAt" | "closedAt">,
  now: Date,
): { from: string; to: string } {
  return {
    from: dayOf(decision.createdAt),
    to: dayOf(decision.closedAt ?? now.toISOString()),
  };
}
