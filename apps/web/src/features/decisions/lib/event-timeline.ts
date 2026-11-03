import type { DecisionEventResponse, MoneyDto } from "@trading/contracts";

export type DecisionEventType = DecisionEventResponse["type"];

/**
 * An event of the decision as the timeline draws it: what happened and the figures its payload
 * carries. The payload is free-form, so each figure is null when the event does not have it or has
 * it malformed, and the timeline then says only what happened.
 */
export interface TimelineItem {
  id: string;
  type: DecisionEventType;
  timestamp: string;
  /** Units, as the decimal string the API gives. */
  quantity: string | null;
  price: MoneyDto | null;
  riskLevel: string | null;
  /** The thesis of a thesis event, or the note of a note event. */
  text: string | null;
}

/** Plain fixed-notation decimal, the only form the API writes quantities and prices in. */
const DECIMAL_STRING = /^\d+(\.\d+)?$/;

function readString(payload: DecisionEventResponse["payload"], key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readDecimal(payload: DecisionEventResponse["payload"], key: string): string | null {
  const value = readString(payload, key);
  return value !== null && DECIMAL_STRING.test(value) ? value : null;
}

/**
 * The events of a decision as the items of its timeline, in the order the API gives them
 * (chronological). The prices are in the currency of the asset.
 */
export function toTimelineItems(
  events: readonly DecisionEventResponse[],
  currency: string,
): TimelineItem[] {
  return events.map((event) => {
    const price = readDecimal(event.payload, "price");
    return {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      quantity: readDecimal(event.payload, "quantity"),
      price: price === null ? null : { amount: price, currency },
      riskLevel: readString(event.payload, "riskLevel"),
      text:
        event.type === "THESIS_RECORDED"
          ? readString(event.payload, "thesis")
          : event.type === "NOTE_ADDED"
            ? readString(event.payload, "note")
            : null,
    };
  });
}
