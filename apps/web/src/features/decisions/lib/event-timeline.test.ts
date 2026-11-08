import type { DecisionEventResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { toTimelineItems } from "./event-timeline";

const event = (
  id: string,
  type: DecisionEventResponse["type"],
  payload: Record<string, unknown> = {},
): DecisionEventResponse => ({
  id,
  decisionId: "d1",
  timestamp: "2026-08-12T10:05:00.000Z",
  type,
  payload,
});

describe("toTimelineItems", () => {
  it("keeps the events in the order they come", () => {
    const items = toTimelineItems(
      [event("e1", "DECISION_CREATED"), event("e2", "POSITION_OPENED"), event("e3", "NOTE_ADDED")],
      "USD",
    );

    expect(items.map((item) => item.id)).toEqual(["e1", "e2", "e3"]);
    expect(items[1]?.timestamp).toBe("2026-08-12T10:05:00.000Z");
  });

  it("reads the quantity and the price of a position, in the currency of the asset", () => {
    const [item] = toTimelineItems(
      [event("e1", "POSITION_OPENED", { quantity: "236", price: "162.40" })],
      "USD",
    );

    expect(item).toMatchObject({
      quantity: "236",
      price: { amount: "162.40", currency: "USD" },
    });
  });

  it("reads the risk level of a risk change", () => {
    const [item] = toTimelineItems([event("e1", "RISK_CHANGED", { riskLevel: "HIGH" })], "USD");

    expect(item?.riskLevel).toBe("HIGH");
  });

  it("reads the thesis of a thesis event and the note of a note event, and nothing else", () => {
    const items = toTimelineItems(
      [
        event("e1", "THESIS_RECORDED", { thesis: "Services keep growing." }),
        event("e2", "NOTE_ADDED", { note: "Review the stop." }),
        event("e3", "PRICE_UPDATE", { note: "ignored", thesis: "ignored" }),
      ],
      "USD",
    );

    expect(items.map((item) => item.text)).toEqual([
      "Services keep growing.",
      "Review the stop.",
      null,
    ]);
  });

  it("leaves a figure out instead of guessing when the payload has it malformed", () => {
    const [item] = toTimelineItems(
      [event("e1", "POSITION_OPENED", { quantity: 236, price: "-3", riskLevel: " " })],
      "USD",
    );

    expect(item).toMatchObject({ quantity: null, price: null, riskLevel: null });
  });

  it("has nothing for a decision without events", () => {
    expect(toTimelineItems([], "USD")).toEqual([]);
  });
});
