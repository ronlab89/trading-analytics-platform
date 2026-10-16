import { describe, expect, it } from "vitest";
import { DecisionEventType } from "@trading/domain";
import { InMemoryDecisionEventRepository } from "./in-memory-decision-event-repository.js";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function build() {
  return new InMemoryDecisionEventRepository({ now: () => day(30) });
}

describe("InMemoryDecisionEventRepository", () => {
  it("creates an event with an id, an empty payload and the timestamp from now by default", async () => {
    const created = await build().create({
      decisionId: "d1",
      type: DecisionEventType.PRICE_UPDATE,
    });
    expect(created.id).not.toBe("");
    expect(created).toMatchObject({
      decisionId: "d1",
      type: DecisionEventType.PRICE_UPDATE,
      payload: {},
      timestamp: day(30),
    });
  });

  it("keeps an explicit payload and a historical timestamp", async () => {
    const created = await build().create({
      decisionId: "d1",
      type: DecisionEventType.PRICE_UPDATE,
      payload: { price: "101" },
      timestamp: day(4),
    });
    expect(created.payload).toEqual({ price: "101" });
    expect(created.timestamp).toEqual(day(4));
  });

  it("lists one decision's events, oldest first", async () => {
    const repository = build();
    const late = await repository.create({
      decisionId: "d1",
      type: DecisionEventType.PRICE_UPDATE,
      timestamp: day(9),
    });
    const early = await repository.create({
      decisionId: "d1",
      type: DecisionEventType.PRICE_UPDATE,
      timestamp: day(2),
    });
    await repository.create({ decisionId: "d2", type: DecisionEventType.PRICE_UPDATE });
    expect(await repository.listByDecisionId("d1")).toEqual([early, late]);
    expect(await repository.listByDecisionId("nobody")).toEqual([]);
  });

  it("keeps creation order between events that share a timestamp, even past nine", async () => {
    const repository = build();
    const created = [];
    for (let i = 0; i < 11; i++) {
      created.push(
        await repository.create({
          decisionId: "d1",
          type: DecisionEventType.PRICE_UPDATE,
          timestamp: day(5),
        }),
      );
    }
    const listed = await repository.listByDecisionId("d1");
    expect(listed.map((e) => e.id)).toEqual(created.map((e) => e.id));
  });
});
