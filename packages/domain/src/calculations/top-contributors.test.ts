import { describe, expect, it } from "vitest";
import { Money } from "../value-objects/money.js";
import { pickTopContributors } from "./top-contributors.js";
import type { SymbolContribution } from "./top-contributors.js";

const item = (symbol: string, amount: string): SymbolContribution => ({
  assetId: `id-${symbol}`,
  symbol,
  contribution: Money.of(amount, "USD"),
});

const summary = (found: SymbolContribution | null) =>
  found === null ? null : [found.symbol, found.contribution.toString()];

describe("pickTopContributors", () => {
  it("should pick the largest gain and the largest loss", () => {
    // The worked example of docs/16-analytics-spec.md §14: A contributes 16 and B -5.
    const { contributor, detractor } = pickTopContributors([item("A", "16"), item("B", "-5")]);

    expect(summary(contributor)).toEqual(["A", "16"]);
    expect(summary(detractor)).toEqual(["B", "-5"]);
  });

  it("should pick the largest among several", () => {
    const { contributor, detractor } = pickTopContributors([
      item("A", "3"),
      item("B", "9"),
      item("C", "-2"),
      item("D", "-7"),
      item("E", "1"),
    ]);

    expect(summary(contributor)).toEqual(["B", "9"]);
    expect(summary(detractor)).toEqual(["D", "-7"]);
  });

  it("should have no detractor when every contribution is zero or more", () => {
    const { contributor, detractor } = pickTopContributors([item("A", "4"), item("B", "0")]);

    expect(summary(contributor)).toEqual(["A", "4"]);
    expect(detractor).toBeNull();
  });

  it("should have no contributor when every contribution is zero or less", () => {
    const { contributor, detractor } = pickTopContributors([item("A", "-4"), item("B", "0")]);

    expect(contributor).toBeNull();
    expect(summary(detractor)).toEqual(["A", "-4"]);
  });

  it("should have neither when every contribution is zero", () => {
    expect(pickTopContributors([item("A", "0"), item("B", "0")])).toEqual({
      contributor: null,
      detractor: null,
    });
  });

  it("should have neither for no contributions", () => {
    expect(pickTopContributors([])).toEqual({ contributor: null, detractor: null });
  });

  it("should break a tie with the alphabetically first symbol, whatever the input order", () => {
    const gains = [item("ZED", "5"), item("ABC", "5"), item("MID", "5")];
    const losses = [item("ZED", "-5"), item("ABC", "-5"), item("MID", "-5")];

    expect(summary(pickTopContributors(gains).contributor)).toEqual(["ABC", "5"]);
    expect(summary(pickTopContributors([...gains].reverse()).contributor)).toEqual(["ABC", "5"]);
    expect(summary(pickTopContributors(losses).detractor)).toEqual(["ABC", "-5"]);
    expect(summary(pickTopContributors([...losses].reverse()).detractor)).toEqual(["ABC", "-5"]);
  });

  it("should keep the asset id of the pick", () => {
    expect(pickTopContributors([item("A", "1")]).contributor?.assetId).toBe("id-A");
  });
});
