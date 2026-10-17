import { describe, expect, it } from "vitest";
import { Money } from "@trading/domain";
import { presentWhatChanged, whatChangedResponseSchema } from "./what-changed.response.js";

const usd = (amount: string) => Money.of(amount, "USD");

describe("presentWhatChanged", () => {
  it("serializes the dates, the contributor, the detractor and the events", () => {
    const dto = presentWhatChanged({
      asOf: new Date("2026-03-31T00:00:00Z"),
      effectiveFrom: new Date("2026-03-01T00:00:00Z"),
      status: "OK",
      contributor: { assetId: "a1", symbol: "AAA", contribution: usd("16") },
      detractor: { assetId: "b1", symbol: "BBB", contribution: usd("-5") },
      events: [
        {
          type: "POSITION_OPENED",
          date: new Date("2026-03-12T00:00:00Z"),
          assetId: "b1",
          symbol: "BBB",
        },
      ],
    });

    expect(dto).toEqual({
      asOf: "2026-03-31",
      effectiveFrom: "2026-03-01",
      status: "OK",
      contributor: {
        assetId: "a1",
        symbol: "AAA",
        contribution: { amount: "16", currency: "USD" },
      },
      detractor: { assetId: "b1", symbol: "BBB", contribution: { amount: "-5", currency: "USD" } },
      events: [{ type: "POSITION_OPENED", date: "2026-03-12", assetId: "b1", symbol: "BBB" }],
    });
    expect(whatChangedResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("keeps a missing contributor, detractor and period as nulls and an empty list", () => {
    const dto = presentWhatChanged({
      asOf: new Date("2026-03-31T00:00:00Z"),
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      contributor: null,
      detractor: null,
      events: [],
    });

    expect(dto).toEqual({
      asOf: "2026-03-31",
      effectiveFrom: null,
      status: "INSUFFICIENT_DATA",
      contributor: null,
      detractor: null,
      events: [],
    });
    expect(whatChangedResponseSchema.safeParse(dto).success).toBe(true);
  });

  it("does not leak fields outside the contract", () => {
    const contributor = { assetId: "a1", symbol: "AAA", contribution: usd("1"), extra: 1 };
    const dto = presentWhatChanged({
      asOf: new Date("2026-03-31T00:00:00Z"),
      effectiveFrom: null,
      status: "OK",
      contributor,
      detractor: null,
      events: [],
    });

    expect(Object.keys(dto.contributor ?? {}).sort()).toEqual([
      "assetId",
      "contribution",
      "symbol",
    ]);
  });
});
